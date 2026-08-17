import { Router } from "express";
import { pool } from "../db.js";
import { verifyPayload } from "../tracking.js";

const router = Router();

// 1x1 transparent gif
const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64",
);

// Open pixel: /t/o/:token
router.get("/o/:token", async (req, res) => {
  const data = verifyPayload(req.params.token);
  if (data?.q && data.q !== "test") {
    try {
      await pool.query(
        `UPDATE email_queue SET opened_at = COALESCE(opened_at, now()),
           status = CASE WHEN status IN ('sent','delivered') THEN 'opened' ELSE status END
         WHERE id = $1`,
        [data.q],
      );
      await pool.query(
        `INSERT INTO campaign_events (campaign_id, queue_id, event_type) VALUES ($1,$2,'open')`,
        [data.c, data.q],
      );
    } catch (e) {
      console.error("open track error", e);
    }
  }
  res.setHeader("Content-Type", "image/gif");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.send(PIXEL);
});

// Click redirect: /t/c/:token
router.get("/c/:token", async (req, res) => {
  const data = verifyPayload(req.params.token);
  if (!data?.u) return res.status(400).send("Invalid link");
  if (data.q && data.q !== "test") {
    try {
      await pool.query(
        `UPDATE email_queue SET clicked_at = COALESCE(clicked_at, now()),
           opened_at = COALESCE(opened_at, now()),
           status = CASE WHEN status IN ('sent','delivered','opened') THEN 'clicked' ELSE status END
         WHERE id = $1`,
        [data.q],
      );
      await pool.query(
        `INSERT INTO campaign_events (campaign_id, queue_id, event_type, metadata) VALUES ($1,$2,'click',$3)`,
        [data.c, data.q, { url: data.u }],
      );
    } catch (e) {
      console.error("click track error", e);
    }
  }
  res.redirect(302, data.u);
});

export default router;
