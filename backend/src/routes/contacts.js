import { Router } from "express";
import { z } from "zod";
import multer from "multer";
import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";
import { pool } from "../db.js";
import { requireAuth } from "../auth.js";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});
router.use(requireAuth);

const contactSchema = z.object({
  email: z.string().email(),
  first_name: z.string().trim().max(120).optional().nullable(),
  last_name: z.string().trim().max(120).optional().nullable(),
  phone: z.string().trim().max(60).optional().nullable(),
  company: z.string().trim().max(180).optional().nullable(),
  job_title: z.string().trim().max(180).optional().nullable(),
  status: z.enum(["subscribed", "unsubscribed", "bounced", "complained"]).optional(),
  source: z.string().trim().max(80).optional().nullable(),
  notes: z.string().max(4000).optional().nullable(),
  list_ids: z.array(z.string().uuid()).optional(),
});

const SELECT_CONTACT = `
  c.id, c.email, c.first_name, c.last_name, c.phone, c.company, c.job_title,
  c.status, c.source, c.notes, c.unsubscribed, c.created_at, c.updated_at,
  COALESCE(
    (SELECT json_agg(json_build_object('id', l.id, 'name', l.name) ORDER BY l.name)
       FROM contact_list_members m JOIN contact_lists l ON l.id = m.list_id
      WHERE m.contact_id = c.id),
    '[]'::json) AS lists
`;

// LIST + search + paginate
router.get("/", async (req, res) => {
  const q = String(req.query.q || "").trim().toLowerCase();
  const status = String(req.query.status || "").trim();
  const listId = String(req.query.list_id || "").trim();
  const limit = Math.min(parseInt(req.query.limit) || 50, 500);
  const offset = parseInt(req.query.offset) || 0;

  const where = [];
  const params = [];
  if (q) {
    params.push(`%${q}%`);
    const p = `$${params.length}`;
    where.push(
      `(lower(c.email) LIKE ${p} OR lower(coalesce(c.first_name,'')) LIKE ${p}
        OR lower(coalesce(c.last_name,'')) LIKE ${p}
        OR lower(coalesce(c.company,'')) LIKE ${p}
        OR lower(coalesce(c.phone,'')) LIKE ${p}
        OR lower(coalesce(c.status,'')) LIKE ${p})`,
    );
  }
  if (status) {
    params.push(status);
    where.push(`c.status = $${params.length}`);
  }
  if (listId) {
    params.push(listId);
    where.push(
      `EXISTS (SELECT 1 FROM contact_list_members m WHERE m.contact_id = c.id AND m.list_id = $${params.length})`,
    );
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  params.push(limit, offset);
  const { rows } = await pool.query(
    `SELECT ${SELECT_CONTACT} FROM contacts c
     ${whereSql}
     ORDER BY c.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  const countParams = params.slice(0, params.length - 2);
  const count = await pool.query(
    `SELECT count(*)::int AS c FROM contacts c ${whereSql}`,
    countParams,
  );
  res.json({ data: rows, total: count.rows[0].c, limit, offset });
});

router.get("/:id", async (req, res) => {
  const { rows } = await pool.query(
    `SELECT ${SELECT_CONTACT} FROM contacts c WHERE c.id = $1`,
    [req.params.id],
  );
  if (!rows[0]) return res.status(404).json({ error: "Not found" });
  res.json(rows[0]);
});

router.post("/", async (req, res) => {
  const p = contactSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.issues[0]?.message || "Invalid input" });
  const d = p.data;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `INSERT INTO contacts
         (email, first_name, last_name, phone, company, job_title, status, source, notes, unsubscribed)
       VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7,'subscribed'),$8,$9,$10)
       RETURNING id`,
      [
        d.email.toLowerCase(),
        d.first_name || null,
        d.last_name || null,
        d.phone || null,
        d.company || null,
        d.job_title || null,
        d.status || null,
        d.source || null,
        d.notes || null,
        d.status === "unsubscribed",
      ],
    );
    const cid = rows[0].id;
    for (const lid of d.list_ids || []) {
      await client.query(
        `INSERT INTO contact_list_members (list_id, contact_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
        [lid, cid],
      );
    }
    await client.query("COMMIT");
    const out = await pool.query(`SELECT ${SELECT_CONTACT} FROM contacts c WHERE c.id = $1`, [cid]);
    res.json(out.rows[0]);
  } catch (e) {
    await client.query("ROLLBACK");
    if (e.code === "23505") return res.status(409).json({ error: "Email already exists" });
    console.error(e);
    res.status(500).json({ error: "Failed to create contact" });
  } finally {
    client.release();
  }
});

router.put("/:id", async (req, res) => {
  const p = contactSchema.partial().safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.issues[0]?.message || "Invalid input" });
  const d = p.data;
  const fields = [];
  const params = [];
  const cols = ["email", "first_name", "last_name", "phone", "company", "job_title", "status", "source", "notes"];
  for (const k of cols) {
    if (d[k] !== undefined) {
      params.push(k === "email" && d[k] ? d[k].toLowerCase() : d[k]);
      fields.push(`${k} = $${params.length}`);
    }
  }
  if (d.status !== undefined) {
    params.push(d.status === "unsubscribed");
    fields.push(`unsubscribed = $${params.length}`);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (fields.length) {
      params.push(req.params.id);
      await client.query(
        `UPDATE contacts SET ${fields.join(", ")}, updated_at = now() WHERE id = $${params.length}`,
        params,
      );
    }
    if (d.list_ids) {
      await client.query(`DELETE FROM contact_list_members WHERE contact_id = $1`, [req.params.id]);
      for (const lid of d.list_ids) {
        await client.query(
          `INSERT INTO contact_list_members (list_id, contact_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
          [lid, req.params.id],
        );
      }
    }
    await client.query("COMMIT");
    const out = await pool.query(`SELECT ${SELECT_CONTACT} FROM contacts c WHERE c.id = $1`, [req.params.id]);
    res.json(out.rows[0] || null);
  } catch (e) {
    await client.query("ROLLBACK");
    if (e.code === "23505") return res.status(409).json({ error: "Email already exists" });
    console.error(e);
    res.status(500).json({ error: "Failed to update contact" });
  } finally {
    client.release();
  }
});

router.delete("/:id", async (req, res) => {
  await pool.query("DELETE FROM contacts WHERE id = $1", [req.params.id]);
  res.json({ ok: true });
});

router.post("/bulk-delete", async (req, res) => {
  const p = z.object({ ids: z.array(z.string().uuid()).min(1) }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: "ids required" });
  const r = await pool.query(`DELETE FROM contacts WHERE id = ANY($1::uuid[])`, [p.data.ids]);
  res.json({ ok: true, deleted: r.rowCount });
});

router.post("/import", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file" });
  const listId = req.body.list_id || null;
  let records;
  try {
    records = parse(req.file.buffer, { columns: true, skip_empty_lines: true, trim: true });
  } catch (e) {
    return res.status(400).json({ error: "Invalid CSV" });
  }
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const seen = new Set();
  const client = await pool.connect();
  let total = records.length;
  let inserted = 0;
  let updated = 0;
  let invalid = 0;
  let duplicates = 0;
  try {
    await client.query("BEGIN");
    for (const r of records) {
      const email = String(r.email || r.Email || "").toLowerCase().trim();
      if (!email || !emailRe.test(email)) { invalid++; continue; }
      if (seen.has(email)) { duplicates++; continue; }
      seen.add(email);
      const first = r.first_name || r.firstName || r["First Name"] || null;
      const last = r.last_name || r.lastName || r["Last Name"] || null;
      const phone = r.phone || r.Phone || null;
      const company = r.company || r.Company || null;
      const job = r.job_title || r.jobTitle || r["Job Title"] || null;
      const source = r.source || r.Source || "csv";
      const ins = await client.query(
        `INSERT INTO contacts (email, first_name, last_name, phone, company, job_title, source)
           VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (email) DO UPDATE SET
           first_name = COALESCE(EXCLUDED.first_name, contacts.first_name),
           last_name  = COALESCE(EXCLUDED.last_name,  contacts.last_name),
           phone      = COALESCE(EXCLUDED.phone,      contacts.phone),
           company    = COALESCE(EXCLUDED.company,    contacts.company),
           job_title  = COALESCE(EXCLUDED.job_title,  contacts.job_title),
           updated_at = now()
         RETURNING id, (xmax = 0) AS inserted`,
        [email, first, last, phone, company, job, source],
      );
      if (ins.rows[0].inserted) inserted++;
      else updated++;
      if (listId) {
        await client.query(
          `INSERT INTO contact_list_members (list_id, contact_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
          [listId, ins.rows[0].id],
        );
      }
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    console.error(e);
    return res.status(500).json({ error: "Import failed" });
  } finally {
    client.release();
  }
  res.json({ total, inserted, updated, duplicates, invalid });
});

router.get("/export.csv", async (req, res) => {
  const listId = String(req.query.list_id || "").trim();
  const q = String(req.query.q || "").trim().toLowerCase();
  const where = [];
  const params = [];
  if (q) {
    params.push(`%${q}%`);
    where.push(`(lower(c.email) LIKE $${params.length} OR lower(coalesce(c.first_name,'')) LIKE $${params.length})`);
  }
  if (listId) {
    params.push(listId);
    where.push(
      `EXISTS (SELECT 1 FROM contact_list_members m WHERE m.contact_id = c.id AND m.list_id = $${params.length})`,
    );
  }
  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const { rows } = await pool.query(
    `SELECT email, first_name, last_name, phone, company, job_title, status, source, notes, created_at
       FROM contacts c ${w} ORDER BY created_at DESC`,
    params,
  );
  const csv = stringify(rows, { header: true });
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="contacts.csv"`);
  res.send(csv);
});

export default router;
