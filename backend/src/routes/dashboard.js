import { Router } from "express";
import { pool } from "../db.js";
import { requireAuth } from "../auth.js";

const router = Router();
router.use(requireAuth);

const pct = (n, d) => (d ? +((n / d) * 100).toFixed(2) : 0);

router.get("/stats", async (_req, res) => {
  const [contacts, lists, campaigns, queue, events] = await Promise.all([
    pool.query(`SELECT count(*)::int AS c FROM contacts`),
    pool.query(`SELECT count(*)::int AS c FROM contact_lists`),
    pool.query(`SELECT count(*)::int AS c FROM campaigns`),
    pool.query(
      `SELECT
        count(*) FILTER (WHERE status IN ('sent','opened','clicked','bounced','complained'))::int AS sent,
        count(*) FILTER (WHERE opened_at IS NOT NULL)::int AS opened,
        count(*) FILTER (WHERE clicked_at IS NOT NULL)::int AS clicked,
        count(*) FILTER (WHERE bounced_at IS NOT NULL)::int AS bounced,
        count(*) FILTER (WHERE complained_at IS NOT NULL)::int AS complained,
        count(*) FILTER (WHERE status = 'failed')::int AS failed
       FROM email_queue`,
    ),
    pool.query(
      `SELECT c.id, c.name, c.status, c.started_at, c.finished_at, c.total_recipients
       FROM campaigns c ORDER BY c.created_at DESC LIMIT 10`,
    ),
  ]);
  const q = queue.rows[0];
  res.json({
    total_contacts: contacts.rows[0].c,
    total_lists: lists.rows[0].c,
    total_campaigns: campaigns.rows[0].c,
    emails_sent: q.sent,
    open_rate: pct(q.opened, q.sent),
    click_rate: pct(q.clicked, q.sent),
    bounce_rate: pct(q.bounced, q.sent),
    complaint_rate: pct(q.complained, q.sent),
    failed_emails: q.failed,
    recent_campaigns: events.rows,
  });
});

// Full dashboard payload — all metrics + sections.
router.get("/summary", async (_req, res) => {
  const since7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [
    contactsR,
    listsR,
    campaignsR,
    queueR,
    suppressedR,
    activityR,
    recentCampaignsR,
    recentEventsR,
    bouncesR,
    complaintsR,
    topCampaignsR,
    snsR,
    providersR,
  ] = await Promise.all([
    pool.query(`SELECT count(*)::int AS c FROM contacts`),
    pool.query(`SELECT count(*)::int AS c FROM contact_lists`),
    pool.query(
      `SELECT
        count(*)::int AS total,
        count(*) FILTER (WHERE status='draft')::int AS draft,
        count(*) FILTER (WHERE status='scheduled')::int AS scheduled,
        count(*) FILTER (WHERE status='sent')::int AS sent,
        count(*) FILTER (WHERE status IN ('queued','sending'))::int AS sending
       FROM campaigns`,
    ),
    pool.query(
      `SELECT
        count(*) FILTER (WHERE status='pending')::int AS queued,
        count(*) FILTER (WHERE status='sending')::int AS sending,
        count(*) FILTER (WHERE status IN ('sent','opened','clicked','bounced','complained'))::int AS sent,
        count(*) FILTER (WHERE delivered_at IS NOT NULL)::int AS delivered,
        count(*) FILTER (WHERE opened_at IS NOT NULL)::int AS opened,
        count(*) FILTER (WHERE clicked_at IS NOT NULL)::int AS clicked,
        count(*) FILTER (WHERE bounced_at IS NOT NULL)::int AS bounced,
        count(*) FILTER (WHERE complained_at IS NOT NULL)::int AS complained,
        count(*) FILTER (WHERE status='failed')::int AS failed
       FROM email_queue`,
    ),
    pool.query(`SELECT count(*)::int AS c FROM suppressed_emails`),
    pool.query(
      `SELECT date_trunc('day', occurred_at) AS day,
              count(*) FILTER (WHERE event_type='send')::int AS sent,
              count(*) FILTER (WHERE event_type='open')::int AS opened,
              count(*) FILTER (WHERE event_type='click')::int AS clicked
       FROM campaign_events
       WHERE occurred_at >= $1
       GROUP BY 1 ORDER BY 1`,
      [since7],
    ),
    pool.query(
      `SELECT c.id, c.name, c.status, c.total_recipients,
              c.started_at, c.finished_at, c.created_at,
              count(q.*) FILTER (WHERE q.opened_at IS NOT NULL)::int AS opens,
              count(q.*) FILTER (WHERE q.clicked_at IS NOT NULL)::int AS clicks,
              count(q.*) FILTER (WHERE q.status IN ('sent','opened','clicked','bounced','complained'))::int AS sent
       FROM campaigns c
       LEFT JOIN email_queue q ON q.campaign_id = c.id
       GROUP BY c.id
       ORDER BY c.created_at DESC LIMIT 8`,
    ),
    pool.query(
      `SELECT e.id, e.event_type, e.occurred_at,
              q.recipient_email, c.name AS campaign_name
       FROM campaign_events e
       LEFT JOIN email_queue q ON q.id = e.queue_id
       LEFT JOIN campaigns c ON c.id = e.campaign_id
       ORDER BY e.occurred_at DESC LIMIT 15`,
    ),
    pool.query(
      `SELECT e.id, e.occurred_at, e.metadata,
              q.recipient_email, c.name AS campaign_name
       FROM campaign_events e
       LEFT JOIN email_queue q ON q.id = e.queue_id
       LEFT JOIN campaigns c ON c.id = e.campaign_id
       WHERE e.event_type='bounce'
       ORDER BY e.occurred_at DESC LIMIT 8`,
    ),
    pool.query(
      `SELECT e.id, e.occurred_at, e.metadata,
              q.recipient_email, c.name AS campaign_name
       FROM campaign_events e
       LEFT JOIN email_queue q ON q.id = e.queue_id
       LEFT JOIN campaigns c ON c.id = e.campaign_id
       WHERE e.event_type='complaint'
       ORDER BY e.occurred_at DESC LIMIT 8`,
    ),
    pool.query(
      `SELECT c.id, c.name, c.total_recipients,
              count(q.*) FILTER (WHERE q.status IN ('sent','opened','clicked','bounced','complained'))::int AS sent,
              count(q.*) FILTER (WHERE q.opened_at IS NOT NULL)::int AS opens,
              count(q.*) FILTER (WHERE q.clicked_at IS NOT NULL)::int AS clicks
       FROM campaigns c
       LEFT JOIN email_queue q ON q.campaign_id = c.id
       WHERE c.status='sent'
       GROUP BY c.id
       HAVING count(q.*) FILTER (WHERE q.status IN ('sent','opened','clicked','bounced','complained')) > 0
       ORDER BY (count(q.*) FILTER (WHERE q.opened_at IS NOT NULL)::float /
                 NULLIF(count(q.*) FILTER (WHERE q.status IN ('sent','opened','clicked','bounced','complained')),0)) DESC NULLS LAST
       LIMIT 5`,
    ),
    pool.query(
      `SELECT
         (SELECT count(*)::int FROM sns_event_log) AS total,
         (SELECT count(*)::int FROM sns_event_log WHERE received_at >= now() - interval '24 hours') AS last_24h,
         (SELECT received_at FROM sns_event_log ORDER BY received_at DESC LIMIT 1) AS last_event_at,
         (SELECT event_type FROM sns_event_log ORDER BY received_at DESC LIMIT 1) AS last_event_type`,
    ),
    pool.query(
      `SELECT id, name, provider, region, status, last_checked_at, is_default
       FROM email_providers ORDER BY is_default DESC, name`,
    ),
  ]);

  const q = queueR.rows[0];
  const unsubR = await pool.query(
    `SELECT count(*)::int AS c FROM campaign_events WHERE event_type='unsubscribe'`,
  );

  res.json({
    metrics: {
      total_contacts: contactsR.rows[0].c,
      total_lists: listsR.rows[0].c,
      total_campaigns: campaignsR.rows[0].total,
      draft_campaigns: campaignsR.rows[0].draft,
      scheduled_campaigns: campaignsR.rows[0].scheduled,
      sent_campaigns: campaignsR.rows[0].sent,
      sending_campaigns: campaignsR.rows[0].sending,
      emails_queued: q.queued + q.sending,
      emails_sent: q.sent,
      emails_delivered: q.delivered,
      emails_opened: q.opened,
      emails_clicked: q.clicked,
      failed_sends: q.failed,
      bounces: q.bounced,
      complaints: q.complained,
      unsubscribes: unsubR.rows[0].c,
      suppressed_emails: suppressedR.rows[0].c,
      delivery_rate: pct(q.delivered, q.sent),
      open_rate: pct(q.opened, q.delivered || q.sent),
      click_rate: pct(q.clicked, q.delivered || q.sent),
      bounce_rate: pct(q.bounced, q.sent),
      complaint_rate: pct(q.complained, q.sent),
    },
    sending_activity: activityR.rows,
    recent_campaigns: recentCampaignsR.rows,
    recent_events: recentEventsR.rows.map((e) => ({
      id: e.id,
      type: e.event_type,
      recipient: e.recipient_email,
      campaign: e.campaign_name,
      at: e.occurred_at,
    })),
    queue_health: {
      pending: q.queued,
      sending: q.sending,
      sent: q.sent,
      failed: q.failed,
    },
    recent_bounces: bouncesR.rows.map((b) => ({
      id: b.id,
      recipient: b.recipient_email || b.metadata?.bouncedRecipients?.[0]?.emailAddress || null,
      campaign: b.campaign_name,
      type: b.metadata?.bounceType || null,
      at: b.occurred_at,
    })),
    recent_complaints: complaintsR.rows.map((c) => ({
      id: c.id,
      recipient: c.recipient_email || c.metadata?.complainedRecipients?.[0]?.emailAddress || null,
      campaign: c.campaign_name,
      feedback_type: c.metadata?.complaintFeedbackType || null,
      at: c.occurred_at,
    })),
    top_campaigns: topCampaignsR.rows.map((c) => ({
      id: c.id,
      name: c.name,
      sent: c.sent,
      opens: c.opens,
      clicks: c.clicks,
      open_rate: pct(c.opens, c.sent),
      click_rate: pct(c.clicks, c.sent),
    })),
    sns_health: snsR.rows[0],
    providers: providersR.rows,
  });
});

export default router;
