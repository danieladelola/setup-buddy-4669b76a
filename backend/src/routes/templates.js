import { Router } from "express";
import { z } from "zod";
import { pool } from "../db.js";
import { requireAuth } from "../auth.js";

const router = Router();
router.use(requireAuth);

router.get("/", async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT id, name, subject, created_at, updated_at FROM email_templates ORDER BY updated_at DESC`,
  );
  res.json({ data: rows });
});

router.get("/:id", async (req, res) => {
  const { rows } = await pool.query(`SELECT * FROM email_templates WHERE id = $1`, [req.params.id]);
  res.json(rows[0] || null);
});

const schema = z.object({
  name: z.string().min(1),
  subject: z.string().min(1),
  html_body: z.string().min(1),
  text_body: z.string().optional(),
});

router.post("/", async (req, res) => {
  const p = schema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: "Invalid input" });
  const { rows } = await pool.query(
    `INSERT INTO email_templates (name, subject, html_body, text_body) VALUES ($1,$2,$3,$4) RETURNING *`,
    [p.data.name, p.data.subject, p.data.html_body, p.data.text_body || null],
  );
  res.json(rows[0]);
});

router.put("/:id", async (req, res) => {
  const p = schema.partial().safeParse(req.body);
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
    `UPDATE email_templates SET ${fields.join(", ")}, updated_at = now() WHERE id = $${i} RETURNING *`,
    params,
  );
  res.json(rows[0] || null);
});

router.delete("/:id", async (req, res) => {
  await pool.query(`DELETE FROM email_templates WHERE id = $1`, [req.params.id]);
  res.json({ ok: true });
});

router.post("/:id/duplicate", async (req, res) => {
  const { rows } = await pool.query(
    `INSERT INTO email_templates (name, subject, html_body, text_body)
     SELECT name || ' (copy)', subject, html_body, text_body FROM email_templates WHERE id = $1
     RETURNING *`,
    [req.params.id],
  );
  if (!rows[0]) return res.status(404).json({ error: "Not found" });
  res.json(rows[0]);
});

export default router;
