import { Router } from "express";
import { z } from "zod";
import { pool } from "../db.js";
import { requireAuth } from "../auth.js";
import { ses } from "../ses.js";
import {
  ListIdentitiesCommand,
  GetIdentityVerificationAttributesCommand,
  VerifyEmailIdentityCommand,
  VerifyDomainIdentityCommand,
  DeleteIdentityCommand,
} from "@aws-sdk/client-ses";

const router = Router();
router.use(requireAuth);

// ---------------- Suppression ----------------
router.get("/suppression", async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT email, reason, details, created_at FROM suppressed_emails
       ORDER BY created_at DESC LIMIT 500`,
  );
  res.json({ items: rows });
});

router.post("/suppression", async (req, res) => {
  const p = z
    .object({ email: z.string().email(), reason: z.string().default("manual") })
    .safeParse(req.body || {});
  if (!p.success) return res.status(400).json({ error: "Valid email required" });
  await pool.query(
    `INSERT INTO suppressed_emails (email, reason, details) VALUES ($1,$2,'{}'::jsonb)
     ON CONFLICT (email) DO UPDATE SET reason=EXCLUDED.reason`,
    [p.data.email.toLowerCase(), p.data.reason],
  );
  res.json({ ok: true });
});

router.delete("/suppression/:email", async (req, res) => {
  await pool.query(`DELETE FROM suppressed_emails WHERE email=$1`, [
    req.params.email.toLowerCase(),
  ]);
  res.json({ ok: true });
});

// ---------------- Unsubscribes ----------------
router.get("/unsubscribes", async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT c.id, c.email, c.unsubscribed_at,
            (SELECT ca.name FROM campaign_events ev
               JOIN campaigns ca ON ca.id = ev.campaign_id
              WHERE ev.event_type='unsubscribe'
                AND (ev.metadata->>'contact_id')::uuid = c.id
              ORDER BY ev.occurred_at DESC LIMIT 1) AS last_campaign
       FROM contacts c
       WHERE c.unsubscribed = true
       ORDER BY c.unsubscribed_at DESC NULLS LAST
       LIMIT 500`,
  );
  res.json({ items: rows });
});

// ---------------- Senders (SES identities) ----------------
router.get("/senders", async (_req, res) => {
  try {
    const list = await ses.send(new ListIdentitiesCommand({ MaxItems: 100 }));
    const identities = list.Identities || [];
    let attrs = {};
    if (identities.length) {
      const v = await ses.send(
        new GetIdentityVerificationAttributesCommand({ Identities: identities }),
      );
      attrs = v.VerificationAttributes || {};
    }
    const defaultEmail = process.env.DEFAULT_FROM_EMAIL;
    res.json({
      items: identities.map((id) => ({
        identity: id,
        type: id.includes("@") ? "email" : "domain",
        status: attrs[id]?.VerificationStatus || "Unknown",
        isDefault: id === defaultEmail,
      })),
    });
  } catch (e) {
    res.status(400).json({ items: [], error: e.message });
  }
});

router.post("/senders", async (req, res) => {
  const p = z.object({ identity: z.string().min(3) }).safeParse(req.body || {});
  if (!p.success) return res.status(400).json({ error: "identity required" });
  const id = p.data.identity.trim();
  try {
    if (id.includes("@")) {
      await ses.send(new VerifyEmailIdentityCommand({ EmailAddress: id }));
    } else {
      await ses.send(new VerifyDomainIdentityCommand({ Domain: id }));
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

router.delete("/senders/:identity", async (req, res) => {
  try {
    await ses.send(new DeleteIdentityCommand({ Identity: req.params.identity }));
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

// ---------------- Email Providers ----------------
router.get("/providers", async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT id, name, provider, region, from_email, from_name,
            configuration_set, sns_topic_arn, is_default, status,
            last_checked_at, last_error, created_at
       FROM email_providers ORDER BY is_default DESC, created_at DESC`,
  );

  // Always include an implicit "env" provider reflecting the running config.
  const envProvider = {
    id: "env",
    name: "AWS SES (env)",
    provider: "ses",
    region: process.env.AWS_REGION || null,
    from_email: process.env.DEFAULT_FROM_EMAIL || null,
    from_name: process.env.DEFAULT_FROM_NAME || null,
    configuration_set: process.env.SES_CONFIGURATION_SET || null,
    sns_topic_arn: process.env.SES_SNS_TOPIC_ARN || null,
    is_default: true,
    status:
      process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
        ? "healthy"
        : "unconfigured",
    source: "env",
  };

  res.json({ items: [envProvider, ...rows.map((r) => ({ ...r, source: "db" }))] });
});

router.post("/providers", async (req, res) => {
  const p = z
    .object({
      name: z.string().min(1),
      provider: z.string().default("ses"),
      region: z.string().optional(),
      from_email: z.string().email().optional(),
      from_name: z.string().optional(),
      configuration_set: z.string().optional(),
      sns_topic_arn: z.string().optional(),
      is_default: z.boolean().optional(),
    })
    .safeParse(req.body || {});
  if (!p.success) return res.status(400).json({ error: p.error.message });
  const d = p.data;
  if (d.is_default) {
    await pool.query(`UPDATE email_providers SET is_default=false`);
  }
  const { rows } = await pool.query(
    `INSERT INTO email_providers
       (name, provider, region, from_email, from_name, configuration_set, sns_topic_arn, is_default)
     VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE($8,false)) RETURNING *`,
    [
      d.name,
      d.provider,
      d.region || null,
      d.from_email || null,
      d.from_name || null,
      d.configuration_set || null,
      d.sns_topic_arn || null,
      d.is_default || false,
    ],
  );
  res.json(rows[0]);
});

router.delete("/providers/:id", async (req, res) => {
  await pool.query(`DELETE FROM email_providers WHERE id=$1`, [req.params.id]);
  res.json({ ok: true });
});

export default router;
