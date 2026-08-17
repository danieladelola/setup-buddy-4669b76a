import { Router } from "express";
import { z } from "zod";
import crypto from "node:crypto";
import { pool } from "../db.js";
import { requireAuth } from "../auth.js";
import { sendEmail } from "../ses.js";
import { personalizeHtml } from "../tracking.js";

const router = Router();
router.use(requireAuth);

router.get("/", async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT id, name, status, scheduled_at, started_at, finished_at, total_recipients,
            from_email, from_name, created_at
     FROM campaigns ORDER BY created_at DESC`,
  );
  res.json({ data: rows });
});

router.get("/:id", async (req, res) => {
  const { rows } = await pool.query(`SELECT * FROM campaigns WHERE id = $1`, [req.params.id]);
  res.json(rows[0] || null);
});

const createSchema = z.object({
  name: z.string().min(1),
  template_id: z.string().uuid().optional(),
  list_id: z.string().uuid(),
  subject: z.string().min(1),
  html_body: z.string().min(1),
  text_body: z.string().optional(),
  from_email: z.string().email(),
  from_name: z.string().min(1),
  scheduled_at: z.string().datetime().optional(),
});

router.post("/", async (req, res) => {
  const p = createSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: "Invalid input", details: p.error.flatten() });
  const d = p.data;
  const { rows } = await pool.query(
    `INSERT INTO campaigns (name, template_id, list_id, subject, html_body, text_body, from_email, from_name, status, scheduled_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [
      d.name,
      d.template_id || null,
      d.list_id,
      d.subject,
      d.html_body,
      d.text_body || null,
      d.from_email,
      d.from_name,
      d.scheduled_at ? "scheduled" : "draft",
      d.scheduled_at || null,
    ],
  );
  res.json(rows[0]);
});

router.put("/:id", async (req, res) => {
  const p = createSchema.partial().safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: "Invalid input" });
  const fields = [];
  const params = [];
  let i = 1;
  for (const [k, v] of Object.entries(p.data)) {
    fields.push(`${k} = $${i++}`);
    params.push(v);
  }
  if (!fields.length) return res.json({ ok: true });
  params.push(req.params.id);
  const { rows } = await pool.query(
    `UPDATE campaigns SET ${fields.join(", ")}, updated_at = now() WHERE id = $${i} AND status IN ('draft','scheduled') RETURNING *`,
    params,
  );
  res.json(rows[0] || null);
});

router.delete("/:id", async (req, res) => {
  await pool.query(`DELETE FROM campaigns WHERE id = $1 AND status IN ('draft','scheduled','cancelled')`, [
    req.params.id,
  ]);
  res.json({ ok: true });
});

// Send a single test email immediately to one address.
router.post("/:id/test", async (req, res) => {
  const p = z.object({ email: z.string().email() }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: "Invalid input" });
  const { rows } = await pool.query(`SELECT * FROM campaigns WHERE id = $1`, [req.params.id]);
  const c = rows[0];
  if (!c) return res.status(404).json({ error: "Not found" });

  const fakeToken = crypto.randomBytes(16).toString("hex");
  const html = personalizeHtml(c.html_body, {
    queueId: "test",
    campaignId: c.id,
    appUrl: process.env.APP_URL,
    unsubToken: fakeToken,
  });
  try {
    const msgId = await sendEmail({
      to: p.data.email,
      fromEmail: c.from_email,
      fromName: c.from_name,
      subject: `[TEST] ${c.subject}`,
      html,
      text: c.text_body,
    });
    res.json({ ok: true, message_id: msgId });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

// Queue the campaign for sending (worker picks it up).
router.post("/:id/send", async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `SELECT * FROM campaigns WHERE id = $1 FOR UPDATE`,
      [req.params.id],
    );
    const c = rows[0];
    if (!c) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Not found" });
    }
    if (!["draft", "scheduled"].includes(c.status)) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: `Cannot send a campaign in status ${c.status}` });
    }

    // Build the recipient set: list members minus unsubscribed minus suppressed.
    const recipients = await client.query(
      `SELECT c.id, c.email FROM contact_list_members m
       JOIN contacts c ON c.id = m.contact_id
       WHERE m.list_id = $1
         AND c.unsubscribed = false
         AND NOT EXISTS (SELECT 1 FROM suppressed_emails s WHERE s.email = c.email)`,
      [c.list_id],
    );

    for (const r of recipients.rows) {
      await client.query(
        `INSERT INTO email_queue (campaign_id, contact_id, recipient_email) VALUES ($1,$2,$3)`,
        [c.id, r.id, r.email],
      );
    }
    await client.query(
      `UPDATE campaigns SET status = 'queued', total_recipients = $1, started_at = now() WHERE id = $2`,
      [recipients.rows.length, c.id],
    );
    await client.query("COMMIT");
    res.json({ ok: true, queued: recipients.rows.length });
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
});

// Report
router.get("/:id/report", async (req, res) => {
  const id = req.params.id;
  const { rows } = await pool.query(
    `SELECT
      (SELECT total_recipients FROM campaigns WHERE id = $1) AS total,
      count(*) FILTER (WHERE status IN ('sent','opened','clicked','bounced','complained'))::int AS sent,
      count(*) FILTER (WHERE delivered_at IS NOT NULL)::int AS delivered,
      count(*) FILTER (WHERE opened_at IS NOT NULL)::int AS opened,
      count(*) FILTER (WHERE clicked_at IS NOT NULL)::int AS clicked,
      count(*) FILTER (WHERE bounced_at IS NOT NULL)::int AS bounced,
      count(*) FILTER (WHERE complained_at IS NOT NULL)::int AS complained,
      count(*) FILTER (WHERE status = 'failed')::int AS failed
     FROM email_queue WHERE campaign_id = $1`,
    [id],
  );
  const unsub = await pool.query(
    `SELECT count(*)::int AS c FROM campaign_events WHERE campaign_id = $1 AND event_type = 'unsubscribe'`,
    [id],
  );
  const r = rows[0] || {};
  const pct = (n) => (r.sent ? +((n / r.sent) * 100).toFixed(2) : 0);
  res.json({
    ...r,
    unsubscribed: unsub.rows[0].c,
    delivery_rate: pct(r.delivered),
    open_rate: pct(r.opened),
    click_rate: pct(r.clicked),
    bounce_rate: pct(r.bounced),
    complaint_rate: pct(r.complained),
  });
});

export default router;
