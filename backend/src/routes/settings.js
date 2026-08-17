import { Router } from "express";
import { z } from "zod";
import { pool } from "../db.js";
import { requireAuth } from "../auth.js";
import {
  getSesConfig,
  verifyCredentials,
  verifyIdentity,
  sendTestEmail,
} from "../ses.js";

const router = Router();
router.use(requireAuth);

// GET /api/settings/ses — masked config + health
router.get("/ses", async (_req, res) => {
  const cfg = getSesConfig();
  const { rows } = await pool.query(
    `SELECT received_at, event_type, message_id FROM sns_event_log
     ORDER BY received_at DESC LIMIT 1`,
  );
  res.json({ ...cfg, lastSnsEvent: rows[0] || null });
});

// POST /api/settings/ses/test-credentials
router.post("/ses/test-credentials", async (_req, res) => {
  try {
    const data = await verifyCredentials();
    res.json(data);
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message, code: e.name });
  }
});

// POST /api/settings/ses/test-identity { identity? }
router.post("/ses/test-identity", async (req, res) => {
  try {
    const data = await verifyIdentity(req.body?.identity);
    res.json(data);
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

// POST /api/settings/ses/test-email { to }
router.post("/ses/test-email", async (req, res) => {
  const schema = z.object({ to: z.string().email() });
  const parse = schema.safeParse(req.body || {});
  if (!parse.success) return res.status(400).json({ error: "Valid 'to' email required" });
  try {
    const data = await sendTestEmail(parse.data.to);
    res.json(data);
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

// GET /api/settings/sns/events — last 10
router.get("/sns/events", async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT id, message_id, event_type, received_at,
            (raw->>'TopicArn') AS topic_arn,
            (raw->>'Subject') AS subject
       FROM sns_event_log
       ORDER BY received_at DESC LIMIT 10`,
  );
  res.json({ events: rows });
});

export default router;
