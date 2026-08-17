import { Router } from "express";
import { pool } from "../db.js";

const router = Router();

const SES_EVENT_TYPES = new Set([
  "Send",
  "Delivery",
  "Bounce",
  "Complaint",
  "Reject",
  "Open",
  "Click",
  "RenderingFailure",
  "DeliveryDelay",
  "Subscription",
]);

const rawParser = (req, _res, next) => {
  let data = "";
  req.setEncoding("utf8");
  req.on("data", (c) => (data += c));
  req.on("end", () => {
    req.rawBody = data;
    try {
      req.body = JSON.parse(data);
    } catch {
      req.body = {};
    }
    next();
  });
};

async function handleSesNotification(msg) {
  const sesMsgId = msg?.mail?.messageId;
  const type = msg?.eventType || msg?.notificationType;
  if (!sesMsgId || !type) return;
  if (!SES_EVENT_TYPES.has(type)) console.warn("sns unknown event type", type);

  const { rows } = await pool.query(
    `SELECT id, campaign_id FROM email_queue WHERE ses_message_id = $1 LIMIT 1`,
    [sesMsgId],
  );
  const queue = rows[0];
  const logEvent = async (eventType, metadata) => {
    if (!queue) return;
    await pool.query(
      `INSERT INTO campaign_events (campaign_id, queue_id, event_type, metadata) VALUES ($1,$2,$3,$4)`,
      [queue.campaign_id, queue.id, eventType, metadata || {}],
    );
  };

  if (type === "Send") {
    await logEvent("send", msg.send || {});
  } else if (type === "Reject") {
    if (queue)
      await pool.query(
        `UPDATE email_queue SET status='failed', last_error=$2 WHERE id=$1`,
        [queue.id, msg.reject?.reason || "rejected"],
      );
    await logEvent("reject", msg.reject || {});
  } else if (type === "RenderingFailure") {
    if (queue)
      await pool.query(
        `UPDATE email_queue SET status='failed', last_error=$2 WHERE id=$1`,
        [queue.id, msg.failure?.errorMessage || "rendering failure"],
      );
    await logEvent("rendering_failure", msg.failure || {});
  } else if (type === "DeliveryDelay") {
    await logEvent("delivery_delay", msg.deliveryDelay || {});
  } else if (type === "Open") {
    if (queue)
      await pool.query(
        `UPDATE email_queue SET opened_at=COALESCE(opened_at, now()) WHERE id=$1`,
        [queue.id],
      );
    await logEvent("open", msg.open || {});
  } else if (type === "Click") {
    if (queue)
      await pool.query(
        `UPDATE email_queue SET clicked_at=COALESCE(clicked_at, now()) WHERE id=$1`,
        [queue.id],
      );
    await logEvent("click", msg.click || {});
  } else if (type === "Delivery") {
    if (queue)
      await pool.query(
        `UPDATE email_queue SET delivered_at=COALESCE(delivered_at, now()) WHERE id=$1`,
        [queue.id],
      );
    await logEvent("delivery", msg.delivery || {});
  } else if (type === "Bounce") {
    // Hard bounces only — soft (Transient) bounces should retry, not suppress.
    if (msg.bounce?.bounceType === "Permanent") {
      for (const r of msg.bounce?.bouncedRecipients || []) {
        if (r.emailAddress)
          await pool.query(
            `INSERT INTO suppressed_emails (email, reason, details) VALUES ($1,'bounce',$2)
             ON CONFLICT (email) DO UPDATE SET reason='bounce', details=EXCLUDED.details`,
            [r.emailAddress.toLowerCase(), msg.bounce],
          );
      }
    }
    if (queue) {
      await pool.query(
        `UPDATE email_queue SET bounced_at=now(), status='bounced' WHERE id=$1`,
        [queue.id],
      );
      await logEvent("bounce", msg.bounce || {});
    }
  } else if (type === "Complaint") {
    for (const r of msg.complaint?.complainedRecipients || []) {
      if (r.emailAddress)
        await pool.query(
          `INSERT INTO suppressed_emails (email, reason, details) VALUES ($1,'complaint',$2)
           ON CONFLICT (email) DO UPDATE SET reason='complaint', details=EXCLUDED.details`,
          [r.emailAddress.toLowerCase(), msg.complaint],
        );
    }
    if (queue) {
      await pool.query(
        `UPDATE email_queue SET complained_at=now(), status='complained' WHERE id=$1`,
        [queue.id],
      );
      await logEvent("complaint", msg.complaint || {});
    }
  }
}

const handleSns = async (req, res) => {
  const body = req.body || {};

  if (process.env.SNS_WEBHOOK_SECRET) {
    const provided = req.query?.secret || req.headers["x-sns-secret"];
    if (provided && provided !== process.env.SNS_WEBHOOK_SECRET) {
      return res.status(401).send("invalid secret");
    }
  }
  if (
    process.env.SES_SNS_TOPIC_ARN &&
    body.TopicArn &&
    body.TopicArn !== process.env.SES_SNS_TOPIC_ARN
  ) {
    console.warn("sns topic mismatch", body.TopicArn);
  }

  try {
    await pool.query(
      `INSERT INTO sns_event_log (message_id, event_type, raw) VALUES ($1,$2,$3)`,
      [body.MessageId || null, body.Type || null, body],
    );
  } catch (e) {
    console.error("sns log err", e);
  }

  if (body.Type === "SubscriptionConfirmation" && body.SubscribeURL) {
    try {
      await fetch(body.SubscribeURL);
    } catch (e) {
      console.error("sns confirm err", e);
    }
    return res.status(200).send("subscribed");
  }
  if (body.Type === "UnsubscribeConfirmation") {
    return res.status(200).send("unsubscribed");
  }
  if (body.Type === "Notification") {
    try {
      const msg =
        typeof body.Message === "string" ? JSON.parse(body.Message) : body.Message;
      await handleSesNotification(msg);
    } catch (e) {
      console.error("sns parse/handle err", e);
    }
  }
  res.status(200).send("ok");
};

router.post("/sns", rawParser, handleSns);
router.post("/api/webhooks/sns", rawParser, handleSns);

export default router;
