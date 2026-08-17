// Shared SES/SNS notification handler. Ported from backend/src/routes/sns.js
// Must be imported lazily from server routes only.

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

const TYPE_MAP: Record<string, string> = {
  Send: "send",
  Delivery: "delivery",
  Bounce: "bounce",
  Complaint: "complaint",
  Reject: "reject",
  Open: "open",
  Click: "click",
  RenderingFailure: "rendering_failure",
  DeliveryDelay: "delivery_delay",
};

function pickPayload(msg: any, type: string) {
  // SES nests the event-specific payload under a lowercased key matching the type.
  const key =
    type === "RenderingFailure"
      ? "failure"
      : type === "DeliveryDelay"
      ? "deliveryDelay"
      : type.toLowerCase();
  return msg?.[key] ?? {};
}

export async function handleSesNotification(msg: any) {
  const { db } = await import("@/lib/db.server");
  const sql = db();
  const sesMsgId = msg?.mail?.messageId;
  const type = msg?.eventType || msg?.notificationType;
  if (!sesMsgId || !type) return;
  if (!SES_EVENT_TYPES.has(type)) {
    console.warn("sns unknown event type", type);
    return;
  }

  const rows = await sql<{ id: string; campaign_id: string }[]>`
    SELECT id, campaign_id FROM email_queue WHERE ses_message_id = ${sesMsgId} LIMIT 1`;
  const queue = rows[0];
  const payload = pickPayload(msg, type);
  const eventType = TYPE_MAP[type] ?? type.toLowerCase();

  const logEvent = async (metadata: any) => {
    if (!queue) return;
    await sql`INSERT INTO campaign_events (campaign_id, queue_id, event_type, metadata)
              VALUES (${queue.campaign_id}, ${queue.id}, ${eventType}, ${sql.json(metadata || {})})`;
  };

  // Queue-state updates per event. COALESCE/CASE guards keep retries idempotent.
  if (queue) {
    if (type === "Send") {
      await sql`UPDATE email_queue
                SET sent_at = COALESCE(sent_at, now()),
                    status = CASE WHEN status IN ('queued','sending') THEN 'sent' ELSE status END
                WHERE id = ${queue.id}`;
    } else if (type === "Delivery") {
      await sql`UPDATE email_queue
                SET delivered_at = COALESCE(delivered_at, now()),
                    status = CASE WHEN status IN ('queued','sending','sent') THEN 'delivered' ELSE status END
                WHERE id = ${queue.id}`;
    } else if (type === "Open") {
      await sql`UPDATE email_queue
                SET opened_at = COALESCE(opened_at, now()),
                    status = CASE WHEN status IN ('sent','delivered') THEN 'opened' ELSE status END
                WHERE id = ${queue.id}`;
    } else if (type === "Click") {
      await sql`UPDATE email_queue
                SET clicked_at = COALESCE(clicked_at, now()),
                    opened_at = COALESCE(opened_at, now()),
                    status = CASE WHEN status IN ('sent','delivered','opened') THEN 'clicked' ELSE status END
                WHERE id = ${queue.id}`;
    } else if (type === "Bounce") {
      await sql`UPDATE email_queue SET bounced_at = COALESCE(bounced_at, now()), status='bounced' WHERE id=${queue.id}`;
    } else if (type === "Complaint") {
      await sql`UPDATE email_queue SET complained_at = COALESCE(complained_at, now()), status='complained' WHERE id=${queue.id}`;
    } else if (type === "Reject") {
      await sql`UPDATE email_queue SET status='failed', last_error=${payload?.reason || "rejected"} WHERE id=${queue.id}`;
    } else if (type === "RenderingFailure") {
      await sql`UPDATE email_queue SET status='failed', last_error=${payload?.errorMessage || "rendering failure"} WHERE id=${queue.id}`;
    }
  }

  // Suppression list updates for bounce/complaint recipients (lowercased, attributed).
  if (type === "Bounce" || type === "Complaint") {
    const { addSuppression } = await import("@/lib/suppression.server");
    const reason = type === "Bounce" ? "bounce" : "complaint";
    const recipients =
      type === "Bounce"
        ? msg.bounce?.bouncedRecipients
        : msg.complaint?.complainedRecipients;
    // Hard bounces only — soft bounces (`Transient`) should retry, not suppress.
    const isHardBounce = type !== "Bounce" || msg.bounce?.bounceType === "Permanent";
    if (isHardBounce) {
      for (const r of recipients || []) {
        if (r?.emailAddress) {
          await addSuppression({
            email: r.emailAddress,
            reason,
            source: "ses_sns",
            campaignId: queue?.campaign_id ?? null,
            details: { ses_message_id: sesMsgId, payload },
          });
        }
      }
    }
  }


  await logEvent(payload);
}

/**
 * @param body parsed SNS envelope
 * @param opts.verified true if signature was verified upstream. SubscribeURL
 *   is only fetched when verified === true, never on unverified envelopes.
 */
export async function handleSnsEnvelope(body: any, opts: { verified: boolean }) {
  const { db } = await import("@/lib/db.server");
  const sql = db();

  // Dedupe: rely on the unique index sns_event_log_message_id_uniq.
  // ON CONFLICT DO NOTHING + RETURNING tells us if this MessageId was new.
  const messageId = body?.MessageId ?? null;
  let isNew = true;
  try {
    const inserted = await sql<{ id: string }[]>`
      INSERT INTO sns_event_log (message_id, event_type, raw)
      VALUES (${messageId}, ${body?.Type || null}, ${sql.json(body)})
      ON CONFLICT (message_id) WHERE message_id IS NOT NULL DO NOTHING
      RETURNING id`;
    isNew = inserted.length > 0;
  } catch (e) {
    console.error("sns log err", e);
  }

  if (!isNew) {
    // Duplicate retry — already processed.
    return "duplicate";
  }

  if (body?.Type === "SubscriptionConfirmation" && body?.SubscribeURL) {
    if (!opts.verified) return "unverified";
    try {
      await fetch(body.SubscribeURL);
    } catch (e) {
      console.error("sns confirm err", e);
    }
    return "subscribed";
  }
  if (body?.Type === "UnsubscribeConfirmation") {
    return "unsubscribed";
  }
  if (body?.Type === "Notification") {
    try {
      const msg = typeof body.Message === "string" ? JSON.parse(body.Message) : body.Message;
      await handleSesNotification(msg);
    } catch (e) {
      console.error("sns parse/handle err", e);
    }
  }
  return "ok";
}
