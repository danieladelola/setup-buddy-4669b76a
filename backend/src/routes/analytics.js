import { Router } from "express";
import { pool } from "../db.js";
import { requireAuth } from "../auth.js";

const router = Router();
router.use(requireAuth);

// ---- helpers ----------------------------------------------------------------
const parseRange = (q) => {
  const to = q.to ? new Date(q.to) : new Date();
  const from = q.from
    ? new Date(q.from)
    : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
  return { from: from.toISOString(), to: to.toISOString() };
};

const pct = (n, d) => (d ? +((n / d) * 100).toFixed(2) : 0);

const csvEscape = (v) => {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const toCsv = (rows, columns) => {
  const header = columns.map((c) => csvEscape(c.label)).join(",");
  const body = rows
    .map((r) => columns.map((c) => csvEscape(r[c.key])).join(","))
    .join("\n");
  return header + "\n" + body + "\n";
};

// ---- overview ---------------------------------------------------------------
router.get("/overview", async (req, res) => {
  const { from, to } = parseRange(req.query);
  const campaignFilter = req.query.campaign_id ? `AND campaign_id = $3` : "";
  const params = [from, to];
  if (req.query.campaign_id) params.push(req.query.campaign_id);

  const [counts, campaignCount, suppressed] = await Promise.all([
    pool.query(
      `SELECT
        count(*) FILTER (WHERE event_type = 'send')::int AS sent,
        count(*) FILTER (WHERE event_type = 'delivery')::int AS delivered,
        count(*) FILTER (WHERE event_type = 'open')::int AS opened,
        count(DISTINCT queue_id) FILTER (WHERE event_type = 'open')::int AS unique_opens,
        count(*) FILTER (WHERE event_type = 'click')::int AS clicked,
        count(DISTINCT queue_id) FILTER (WHERE event_type = 'click')::int AS unique_clicks,
        count(*) FILTER (WHERE event_type = 'bounce')::int AS bounced,
        count(*) FILTER (WHERE event_type = 'complaint')::int AS complained,
        count(*) FILTER (WHERE event_type = 'unsubscribe')::int AS unsubscribed,
        count(*) FILTER (WHERE event_type IN ('failed','reject','rendering_failure'))::int AS failed
       FROM campaign_events
       WHERE occurred_at BETWEEN $1 AND $2 ${campaignFilter}`,
      params,
    ),
    pool.query(
      `SELECT count(*)::int AS c FROM campaigns
        WHERE created_at BETWEEN $1 AND $2`,
      [from, to],
    ),
    pool.query(
      `SELECT count(*)::int AS c FROM suppressed_emails
        WHERE created_at BETWEEN $1 AND $2`,
      [from, to],
    ),
  ]);

  const c = counts.rows[0];
  // Fallback: if no send events recorded (older sends), use email_queue counts.
  let sentBase = c.sent;
  if (!sentBase) {
    const q = await pool.query(
      `SELECT
         count(*) FILTER (WHERE q.status IN ('sent','opened','clicked','bounced','complained'))::int AS sent,
         count(*) FILTER (WHERE q.delivered_at IS NOT NULL)::int AS delivered,
         count(*) FILTER (WHERE q.opened_at IS NOT NULL)::int AS opened,
         count(*) FILTER (WHERE q.clicked_at IS NOT NULL)::int AS clicked,
         count(*) FILTER (WHERE q.bounced_at IS NOT NULL)::int AS bounced,
         count(*) FILTER (WHERE q.complained_at IS NOT NULL)::int AS complained,
         count(*) FILTER (WHERE q.status = 'failed')::int AS failed
       FROM email_queue q
       WHERE q.created_at BETWEEN $1 AND $2
         ${req.query.campaign_id ? "AND q.campaign_id = $3" : ""}`,
      params,
    );
    const qr = q.rows[0];
    sentBase = qr.sent;
    c.sent = qr.sent;
    c.delivered = c.delivered || qr.delivered;
    c.opened = c.opened || qr.opened;
    c.clicked = c.clicked || qr.clicked;
    c.bounced = c.bounced || qr.bounced;
    c.complained = c.complained || qr.complained;
    c.failed = c.failed || qr.failed;
  }

  res.json({
    range: { from, to },
    total_campaigns: campaignCount.rows[0].c,
    suppressed_added: suppressed.rows[0].c,
    sent: c.sent,
    delivered: c.delivered,
    opened: c.opened,
    unique_opens: c.unique_opens || 0,
    clicked: c.clicked,
    unique_clicks: c.unique_clicks || 0,
    bounced: c.bounced,
    complained: c.complained,
    unsubscribed: c.unsubscribed,
    failed: c.failed,
    delivery_rate: pct(c.delivered, sentBase),
    open_rate: pct(c.unique_opens || c.opened, c.delivered || sentBase),
    click_rate: pct(c.unique_clicks || c.clicked, c.delivered || sentBase),
    bounce_rate: pct(c.bounced, sentBase),
    complaint_rate: pct(c.complained, sentBase),
    unsubscribe_rate: pct(c.unsubscribed, c.delivered || sentBase),
  });
});

// ---- trends -----------------------------------------------------------------
router.get("/trends", async (req, res) => {
  const { from, to } = parseRange(req.query);
  const interval = req.query.interval === "hour" ? "hour" : "day";
  const campaignFilter = req.query.campaign_id ? `AND campaign_id = $3` : "";
  const params = [from, to];
  if (req.query.campaign_id) params.push(req.query.campaign_id);

  const { rows } = await pool.query(
    `SELECT
       date_trunc('${interval}', occurred_at) AS bucket,
       count(*) FILTER (WHERE event_type='send')::int AS sent,
       count(*) FILTER (WHERE event_type='delivery')::int AS delivered,
       count(*) FILTER (WHERE event_type='open')::int AS opened,
       count(*) FILTER (WHERE event_type='click')::int AS clicked,
       count(*) FILTER (WHERE event_type='bounce')::int AS bounced,
       count(*) FILTER (WHERE event_type='complaint')::int AS complained,
       count(*) FILTER (WHERE event_type='unsubscribe')::int AS unsubscribed
     FROM campaign_events
     WHERE occurred_at BETWEEN $1 AND $2 ${campaignFilter}
     GROUP BY 1 ORDER BY 1`,
    params,
  );
  res.json({ interval, points: rows });
});

// ---- per-campaign performance ----------------------------------------------
router.get("/campaigns", async (req, res) => {
  const { from, to } = parseRange(req.query);
  const { rows } = await pool.query(
    `SELECT
       c.id, c.name, c.status, c.from_email, c.from_name,
       c.total_recipients, c.started_at, c.finished_at, c.created_at,
       count(q.*) FILTER (WHERE q.status IN ('sent','opened','clicked','bounced','complained'))::int AS sent,
       count(q.*) FILTER (WHERE q.delivered_at IS NOT NULL)::int AS delivered,
       count(q.*) FILTER (WHERE q.opened_at IS NOT NULL)::int AS unique_opens,
       count(q.*) FILTER (WHERE q.clicked_at IS NOT NULL)::int AS unique_clicks,
       count(q.*) FILTER (WHERE q.bounced_at IS NOT NULL)::int AS bounced,
       count(q.*) FILTER (WHERE q.complained_at IS NOT NULL)::int AS complained,
       count(q.*) FILTER (WHERE q.status='failed')::int AS failed,
       (SELECT count(*)::int FROM campaign_events e WHERE e.campaign_id=c.id AND e.event_type='open') AS opens,
       (SELECT count(*)::int FROM campaign_events e WHERE e.campaign_id=c.id AND e.event_type='click') AS clicks,
       (SELECT count(*)::int FROM campaign_events e WHERE e.campaign_id=c.id AND e.event_type='unsubscribe') AS unsubscribed
     FROM campaigns c
     LEFT JOIN email_queue q ON q.campaign_id = c.id
     WHERE c.created_at BETWEEN $1 AND $2
     GROUP BY c.id
     ORDER BY c.created_at DESC`,
    [from, to],
  );
  const items = rows.map((r) => ({
    ...r,
    delivery_rate: pct(r.delivered, r.sent),
    open_rate: pct(r.unique_opens, r.delivered || r.sent),
    click_rate: pct(r.unique_clicks, r.delivered || r.sent),
    bounce_rate: pct(r.bounced, r.sent),
    complaint_rate: pct(r.complained, r.sent),
  }));
  res.json({ items });
});

// ---- tracking events (opens/clicks) ----------------------------------------
router.get("/tracking", async (req, res) => {
  const { from, to } = parseRange(req.query);
  const limit = Math.min(parseInt(req.query.limit || "200", 10), 1000);
  const types =
    req.query.type === "open"
      ? ["open"]
      : req.query.type === "click"
      ? ["click"]
      : ["open", "click"];
  const params = [from, to, types, limit];
  let campaignClause = "";
  if (req.query.campaign_id) {
    params.push(req.query.campaign_id);
    campaignClause = `AND e.campaign_id = $${params.length}`;
  }
  const { rows } = await pool.query(
    `SELECT
       e.id, e.campaign_id, e.queue_id, e.event_type,
       e.metadata, e.occurred_at,
       c.name AS campaign_name,
       q.recipient_email
     FROM campaign_events e
     LEFT JOIN campaigns c ON c.id = e.campaign_id
     LEFT JOIN email_queue q ON q.id = e.queue_id
     WHERE e.occurred_at BETWEEN $1 AND $2
       AND e.event_type = ANY($3) ${campaignClause}
     ORDER BY e.occurred_at DESC
     LIMIT $4`,
    params,
  );
  const items = rows.map((r) => {
    const m = r.metadata || {};
    return {
      id: r.id,
      campaign_id: r.campaign_id,
      campaign_name: r.campaign_name,
      queue_id: r.queue_id,
      event_type: r.event_type,
      recipient_email: r.recipient_email,
      link_url: m.url || m.link || (m.linkUrl ?? null),
      user_agent: m.userAgent || m.user_agent || null,
      ip_address: m.ipAddress || m.ip || null,
      occurred_at: r.occurred_at,
    };
  });
  res.json({ items });
});

router.get("/top-links", async (req, res) => {
  const { from, to } = parseRange(req.query);
  const params = [from, to];
  let clause = "";
  if (req.query.campaign_id) {
    params.push(req.query.campaign_id);
    clause = `AND campaign_id = $${params.length}`;
  }
  const { rows } = await pool.query(
    `SELECT metadata->>'url' AS url,
            count(*)::int AS clicks,
            count(DISTINCT queue_id)::int AS unique_clicks
     FROM campaign_events
     WHERE event_type='click'
       AND occurred_at BETWEEN $1 AND $2
       AND metadata ? 'url' ${clause}
     GROUP BY 1
     ORDER BY clicks DESC
     LIMIT 50`,
    params,
  );
  res.json({ items: rows });
});

// ---- bounces & complaints --------------------------------------------------
router.get("/bounces", async (req, res) => {
  const { from, to } = parseRange(req.query);
  const { rows } = await pool.query(
    `SELECT e.id, e.campaign_id, e.queue_id, e.metadata, e.occurred_at,
            c.name AS campaign_name, q.recipient_email, q.ses_message_id
     FROM campaign_events e
     LEFT JOIN campaigns c ON c.id = e.campaign_id
     LEFT JOIN email_queue q ON q.id = e.queue_id
     WHERE e.event_type = 'bounce' AND e.occurred_at BETWEEN $1 AND $2
     ORDER BY e.occurred_at DESC LIMIT 500`,
    [from, to],
  );
  const items = rows.map((r) => {
    const m = r.metadata || {};
    const recipient =
      m.bouncedRecipients?.[0]?.emailAddress || r.recipient_email || null;
    return {
      id: r.id,
      campaign_id: r.campaign_id,
      campaign_name: r.campaign_name,
      recipient_email: recipient,
      bounce_type: m.bounceType || null,
      bounce_subtype: m.bounceSubType || null,
      reason:
        m.bouncedRecipients?.[0]?.diagnosticCode ||
        m.bouncedRecipients?.[0]?.status ||
        null,
      provider_message_id: r.ses_message_id,
      occurred_at: r.occurred_at,
    };
  });
  res.json({ items });
});

router.get("/complaints", async (req, res) => {
  const { from, to } = parseRange(req.query);
  const { rows } = await pool.query(
    `SELECT e.id, e.campaign_id, e.queue_id, e.metadata, e.occurred_at,
            c.name AS campaign_name, q.recipient_email, q.ses_message_id
     FROM campaign_events e
     LEFT JOIN campaigns c ON c.id = e.campaign_id
     LEFT JOIN email_queue q ON q.id = e.queue_id
     WHERE e.event_type = 'complaint' AND e.occurred_at BETWEEN $1 AND $2
     ORDER BY e.occurred_at DESC LIMIT 500`,
    [from, to],
  );
  const items = rows.map((r) => {
    const m = r.metadata || {};
    const recipient =
      m.complainedRecipients?.[0]?.emailAddress || r.recipient_email || null;
    return {
      id: r.id,
      campaign_id: r.campaign_id,
      campaign_name: r.campaign_name,
      recipient_email: recipient,
      feedback_type: m.complaintFeedbackType || null,
      user_agent: m.userAgent || null,
      provider_message_id: r.ses_message_id,
      occurred_at: r.occurred_at,
    };
  });
  res.json({ items });
});

// ---- raw event ------------------------------------------------------------
router.get("/events/:id/raw", async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, campaign_id, queue_id, event_type, metadata, occurred_at
     FROM campaign_events WHERE id = $1`,
    [req.params.id],
  );
  res.json(rows[0] || null);
});

router.get("/sns-log", async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || "200", 10), 1000);
  const { rows } = await pool.query(
    `SELECT id, message_id, event_type, raw, received_at
     FROM sns_event_log ORDER BY received_at DESC LIMIT $1`,
    [limit],
  );
  res.json({ items: rows });
});

// ---- CSV export ------------------------------------------------------------
router.get("/export", async (req, res) => {
  const type = req.query.type || "campaigns";
  const { from, to } = parseRange(req.query);
  let rows = [];
  let columns = [];

  if (type === "campaigns") {
    const r = await pool.query(
      `SELECT
         c.name, c.status, c.from_email, c.total_recipients,
         count(q.*) FILTER (WHERE q.status IN ('sent','opened','clicked','bounced','complained'))::int AS sent,
         count(q.*) FILTER (WHERE q.delivered_at IS NOT NULL)::int AS delivered,
         count(q.*) FILTER (WHERE q.opened_at IS NOT NULL)::int AS unique_opens,
         count(q.*) FILTER (WHERE q.clicked_at IS NOT NULL)::int AS unique_clicks,
         count(q.*) FILTER (WHERE q.bounced_at IS NOT NULL)::int AS bounced,
         count(q.*) FILTER (WHERE q.complained_at IS NOT NULL)::int AS complained,
         c.created_at
       FROM campaigns c
       LEFT JOIN email_queue q ON q.campaign_id = c.id
       WHERE c.created_at BETWEEN $1 AND $2
       GROUP BY c.id ORDER BY c.created_at DESC`,
      [from, to],
    );
    rows = r.rows;
    columns = [
      { key: "name", label: "Campaign" },
      { key: "status", label: "Status" },
      { key: "from_email", label: "From" },
      { key: "total_recipients", label: "Recipients" },
      { key: "sent", label: "Sent" },
      { key: "delivered", label: "Delivered" },
      { key: "unique_opens", label: "Unique Opens" },
      { key: "unique_clicks", label: "Unique Clicks" },
      { key: "bounced", label: "Bounced" },
      { key: "complained", label: "Complained" },
      { key: "created_at", label: "Created" },
    ];
  } else if (type === "bounces" || type === "complaints") {
    const ev = type === "bounces" ? "bounce" : "complaint";
    const r = await pool.query(
      `SELECT q.recipient_email, c.name AS campaign, e.metadata, e.occurred_at,
              q.ses_message_id
       FROM campaign_events e
       LEFT JOIN campaigns c ON c.id = e.campaign_id
       LEFT JOIN email_queue q ON q.id = e.queue_id
       WHERE e.event_type=$1 AND e.occurred_at BETWEEN $2 AND $3
       ORDER BY e.occurred_at DESC`,
      [ev, from, to],
    );
    rows = r.rows.map((x) => ({
      recipient_email: x.recipient_email,
      campaign: x.campaign,
      message_id: x.ses_message_id,
      type: x.metadata?.bounceType || x.metadata?.complaintFeedbackType || "",
      subtype: x.metadata?.bounceSubType || "",
      occurred_at: x.occurred_at,
    }));
    columns = [
      { key: "recipient_email", label: "Email" },
      { key: "campaign", label: "Campaign" },
      { key: "type", label: "Type" },
      { key: "subtype", label: "Subtype" },
      { key: "message_id", label: "Message ID" },
      { key: "occurred_at", label: "Occurred At" },
    ];
  } else {
    return res.status(400).json({ error: "Unknown export type" });
  }

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${type}-${new Date().toISOString().slice(0, 10)}.csv"`,
  );
  res.send(toCsv(rows, columns));
});

export default router;
