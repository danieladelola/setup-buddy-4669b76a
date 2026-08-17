import { Router } from "express";
import { z } from "zod";
import { stringify } from "csv-stringify/sync";
import { pool } from "../db.js";
import { requireAuth } from "../auth.js";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  const q = String(req.query.q || "").trim().toLowerCase();
  const params = [];
  let where = "";
  if (q) {
    params.push(`%${q}%`);
    where = `WHERE lower(l.name) LIKE $1 OR lower(coalesce(l.description,'')) LIKE $1`;
  }
  const { rows } = await pool.query(
    `SELECT l.id, l.name, l.description, l.created_at,
       (SELECT count(*)::int FROM contact_list_members m WHERE m.list_id = l.id) AS member_count
     FROM contact_lists l ${where} ORDER BY l.created_at DESC`,
    params,
  );
  res.json({ data: rows });
});

router.post("/", async (req, res) => {
  const p = z.object({ name: z.string().min(1), description: z.string().optional() }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: "Invalid input" });
  try {
    const { rows } = await pool.query(
      `INSERT INTO contact_lists (name, description) VALUES ($1,$2) RETURNING *`,
      [p.data.name.trim(), p.data.description || null],
    );
    res.json(rows[0]);
  } catch (e) {
    if (e.code === "23505") return res.status(409).json({ error: "A list with that name already exists" });
    throw e;
  }
});

router.put("/:id", async (req, res) => {
  const p = z
    .object({ name: z.string().optional(), description: z.string().nullable().optional() })
    .safeParse(req.body);
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
  try {
    const { rows } = await pool.query(
      `UPDATE contact_lists SET ${fields.join(", ")} WHERE id = $${i} RETURNING *`,
      params,
    );
    res.json(rows[0] || null);
  } catch (e) {
    if (e.code === "23505") return res.status(409).json({ error: "A list with that name already exists" });
    throw e;
  }
});

router.delete("/:id", async (req, res) => {
  await pool.query("DELETE FROM contact_lists WHERE id = $1", [req.params.id]);
  res.json({ ok: true });
});

router.get("/:id/members", async (req, res) => {
  const { rows } = await pool.query(
    `SELECT c.id, c.email, c.first_name, c.last_name, c.unsubscribed, m.added_at
     FROM contact_list_members m JOIN contacts c ON c.id = m.contact_id
     WHERE m.list_id = $1 ORDER BY m.added_at DESC`,
    [req.params.id],
  );
  res.json({ data: rows });
});

router.post("/:id/members", async (req, res) => {
  const p = z.object({ contact_ids: z.array(z.string().uuid()).min(1) }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: "Invalid input" });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const cid of p.data.contact_ids) {
      await client.query(
        `INSERT INTO contact_list_members (list_id, contact_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
        [req.params.id, cid],
      );
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
  res.json({ ok: true });
});

router.delete("/:id/members/:contactId", async (req, res) => {
  await pool.query(
    `DELETE FROM contact_list_members WHERE list_id = $1 AND contact_id = $2`,
    [req.params.id, req.params.contactId],
  );
  res.json({ ok: true });
});

router.get("/:id/export.csv", async (req, res) => {
  const { rows } = await pool.query(
    `SELECT c.email, c.first_name, c.last_name, c.phone, c.company, c.job_title, c.status, m.added_at
       FROM contact_list_members m JOIN contacts c ON c.id = m.contact_id
      WHERE m.list_id = $1 ORDER BY m.added_at DESC`,
    [req.params.id],
  );
  const csv = stringify(rows, { header: true });
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="list-${req.params.id}.csv"`);
  res.send(csv);
});

export default router;
