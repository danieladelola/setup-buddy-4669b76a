import { Router } from "express";
import { pool } from "../db.js";

const router = Router();

const page = (title, body) => `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:system-ui,sans-serif;max-width:520px;margin:80px auto;padding:0 24px;color:#111}
h1{font-size:22px;margin:0 0 12px}p{color:#555;line-height:1.5}
button,a.btn{display:inline-block;background:#111;color:#fff;border:0;padding:10px 16px;border-radius:6px;text-decoration:none;cursor:pointer}
</style></head><body>${body}</body></html>`;

router.get("/u/:token", async (req, res) => {
  const { rows } = await pool.query(
    `SELECT t.token, c.email FROM unsubscribe_tokens t JOIN contacts c ON c.id = t.contact_id WHERE t.token = $1`,
    [req.params.token],
  );
  if (!rows[0]) return res.status(404).send(page("Invalid link", `<h1>Invalid link</h1>`));
  res.send(
    page(
      "Unsubscribe",
      `<h1>Unsubscribe ${rows[0].email}?</h1>
       <p>Click the button below to stop receiving emails from HSENations.</p>
       <form method="POST" action="/u/${req.params.token}"><button type="submit">Unsubscribe me</button></form>`,
    ),
  );
});

router.post("/u/:token", async (req, res) => {
  const { rows } = await pool.query(
    `SELECT contact_id, campaign_id FROM unsubscribe_tokens WHERE token = $1`,
    [req.params.token],
  );
  if (!rows[0]) return res.status(404).send(page("Invalid link", `<h1>Invalid link</h1>`));
  const { contact_id, campaign_id } = rows[0];
  await pool.query(
    `UPDATE contacts SET unsubscribed = true, unsubscribed_at = now() WHERE id = $1`,
    [contact_id],
  );
  if (campaign_id) {
    await pool.query(
      `INSERT INTO campaign_events (campaign_id, event_type, metadata) VALUES ($1,'unsubscribe',$2)`,
      [campaign_id, { contact_id }],
    );
  }
  res.send(page("Unsubscribed", `<h1>You're unsubscribed</h1><p>We won't email you again.</p>`));
});

export default router;
