import "./env.js";
import crypto from "node:crypto";
import { pool } from "./db.js";
import { sendEmail } from "./ses.js";
import { personalizeHtml } from "./tracking.js";

const BATCH = parseInt(process.env.WORKER_BATCH || "20", 10);
const INTERVAL = parseInt(process.env.WORKER_INTERVAL_MS || "2000", 10);
const MAX_ATTEMPTS = 3;
const APP_URL = process.env.APP_URL || "http://localhost:8080";

async function activateScheduled() {
  await pool.query(
    `UPDATE campaigns SET status = 'queued', started_at = COALESCE(started_at, now())
     WHERE status = 'scheduled' AND scheduled_at <= now()`,
  );
}

async function fetchBatch() {
  const { rows } = await pool.query(
    `UPDATE email_queue SET status = 'sending', attempts = attempts + 1
     WHERE id IN (
       SELECT q.id FROM email_queue q
       JOIN campaigns c ON c.id = q.campaign_id
       WHERE q.status IN ('pending')
         AND c.status IN ('queued','sending')
       ORDER BY q.created_at ASC
       LIMIT $1
       FOR UPDATE SKIP LOCKED
     )
     RETURNING id, campaign_id, contact_id, recipient_email, attempts`,
    [BATCH],
  );
  return rows;
}

async function getOrCreateUnsubToken(contactId, campaignId) {
  if (!contactId) return crypto.randomBytes(16).toString("hex");
  const existing = await pool.query(
    `SELECT token FROM unsubscribe_tokens WHERE contact_id = $1 AND campaign_id IS NOT DISTINCT FROM $2`,
    [contactId, campaignId],
  );
  if (existing.rows[0]) return existing.rows[0].token;
  const token = crypto.randomBytes(24).toString("hex");
  await pool.query(
    `INSERT INTO unsubscribe_tokens (token, contact_id, campaign_id) VALUES ($1,$2,$3)`,
    [token, contactId, campaignId],
  );
  return token;
}

async function processOne(item) {
  const c = await pool.query(`SELECT * FROM campaigns WHERE id = $1`, [item.campaign_id]);
  const camp = c.rows[0];
  if (!camp) return;

  // Skip suppressed
  const sup = await pool.query(`SELECT 1 FROM suppressed_emails WHERE email = $1`, [item.recipient_email]);
  if (sup.rows[0]) {
    await pool.query(
      `UPDATE email_queue SET status = 'failed', last_error = 'suppressed' WHERE id = $1`,
      [item.id],
    );
    return;
  }
  // Skip unsubscribed
  if (item.contact_id) {
    const u = await pool.query(`SELECT unsubscribed FROM contacts WHERE id = $1`, [item.contact_id]);
    if (u.rows[0]?.unsubscribed) {
      await pool.query(
        `UPDATE email_queue SET status = 'failed', last_error = 'unsubscribed' WHERE id = $1`,
        [item.id],
      );
      return;
    }
  }

  const unsubToken = await getOrCreateUnsubToken(item.contact_id, camp.id);
  const html = personalizeHtml(camp.html_body, {
    queueId: item.id,
    campaignId: camp.id,
    appUrl: APP_URL,
    unsubToken,
  });

  try {
    const msgId = await sendEmail({
      to: item.recipient_email,
      fromEmail: camp.from_email,
      fromName: camp.from_name,
      subject: camp.subject,
      html,
      text: camp.text_body,
    });
    await pool.query(
      `UPDATE email_queue SET status = 'sent', sent_at = now(), ses_message_id = $2 WHERE id = $1`,
      [item.id, msgId],
    );
    await pool.query(
      `INSERT INTO campaign_events (campaign_id, queue_id, event_type, metadata) VALUES ($1,$2,'send',$3)`,
      [camp.id, item.id, { ses_message_id: msgId }],
    );
  } catch (e) {
    const err = String(e?.message || e);
    if (item.attempts >= MAX_ATTEMPTS) {
      await pool.query(
        `UPDATE email_queue SET status = 'failed', last_error = $2 WHERE id = $1`,
        [item.id, err],
      );
      await pool.query(
        `INSERT INTO campaign_events (campaign_id, queue_id, event_type, metadata) VALUES ($1,$2,'failed',$3)`,
        [camp.id, item.id, { error: err }],
      );
    } else {
      // back to pending for retry
      await pool.query(
        `UPDATE email_queue SET status = 'pending', last_error = $2 WHERE id = $1`,
        [item.id, err],
      );
    }
  }
}

async function finalizeCampaigns() {
  await pool.query(
    `UPDATE campaigns c SET status = 'sent', finished_at = now()
     WHERE c.status IN ('queued','sending')
       AND NOT EXISTS (SELECT 1 FROM email_queue q WHERE q.campaign_id = c.id AND q.status IN ('pending','sending'))`,
  );
  await pool.query(
    `UPDATE campaigns SET status = 'sending' WHERE status = 'queued'
       AND EXISTS (SELECT 1 FROM email_queue q WHERE q.campaign_id = campaigns.id AND q.status IN ('sending','sent'))`,
  );
}

async function tick() {
  try {
    await activateScheduled();
    const batch = await fetchBatch();
    if (batch.length) {
      console.log(`Sending ${batch.length} emails...`);
      await Promise.all(batch.map(processOne));
    }
    await finalizeCampaigns();
  } catch (e) {
    console.error("worker tick err", e);
  }
}

console.log(`Worker started (batch=${BATCH}, interval=${INTERVAL}ms)`);
setInterval(tick, INTERVAL);
tick();
