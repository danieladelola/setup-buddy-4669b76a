import { createFileRoute } from "@tanstack/react-router";
import { requireAuth, json } from "@/lib/server-auth";

const pct = (n: number, d: number) => (d ? +((n / d) * 100).toFixed(2) : 0);

// Batch 4: short in-process cache. The summary is expensive (14 queries, multiple
// aggregates) and the dashboard is polled. 30s freshness is acceptable for ops view.
// Per-Worker isolate cache — fine for our deployment model; warms quickly under load.
const CACHE_TTL_MS = 30_000;
let _cache: { at: number; payload: any } | null = null as { at: number; payload: any } | null;

export const Route = createFileRoute("/api/dashboard/summary")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await requireAuth(request);
        if (auth instanceof Response) return auth;

        const url = new URL(request.url);
        const bypass = url.searchParams.get("fresh") === "1";
        if (!bypass && _cache && Date.now() - _cache.at < CACHE_TTL_MS) {
          return json(_cache.payload);
        }

        try {
        const { db } = await import("@/lib/db.server");
        const sql = db();
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
          unsubR,
        ] = await Promise.all([
          sql`SELECT count(*)::int AS c FROM contacts`,
          sql`SELECT count(*)::int AS c FROM contact_lists`,
          sql`SELECT
                count(*)::int AS total,
                count(*) FILTER (WHERE status='draft')::int AS draft,
                count(*) FILTER (WHERE status='scheduled')::int AS scheduled,
                count(*) FILTER (WHERE status='sent')::int AS sent,
                count(*) FILTER (WHERE status IN ('queued','sending'))::int AS sending
              FROM campaigns`,
          sql`SELECT
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
          sql`SELECT count(*)::int AS c FROM suppressed_emails`,
          sql`SELECT date_trunc('day', occurred_at) AS day,
                     count(*) FILTER (WHERE event_type='send')::int AS sent,
                     count(*) FILTER (WHERE event_type='open')::int AS opened,
                     count(*) FILTER (WHERE event_type='click')::int AS clicked
              FROM campaign_events
              WHERE occurred_at >= ${since7}
              GROUP BY 1 ORDER BY 1`,
          sql`SELECT c.id, c.name, c.status, c.total_recipients,
                     c.started_at, c.finished_at, c.created_at,
                     count(q.*) FILTER (WHERE q.opened_at IS NOT NULL)::int AS opens,
                     count(q.*) FILTER (WHERE q.clicked_at IS NOT NULL)::int AS clicks,
                     count(q.*) FILTER (WHERE q.status IN ('sent','opened','clicked','bounced','complained'))::int AS sent
              FROM campaigns c
              LEFT JOIN email_queue q ON q.campaign_id = c.id
              GROUP BY c.id
              ORDER BY c.created_at DESC LIMIT 8`,
          sql`SELECT e.id, e.event_type, e.occurred_at,
                     q.recipient_email, c.name AS campaign_name
              FROM campaign_events e
              LEFT JOIN email_queue q ON q.id = e.queue_id
              LEFT JOIN campaigns c ON c.id = e.campaign_id
              ORDER BY e.occurred_at DESC LIMIT 15`,
          sql`SELECT e.id, e.occurred_at, e.metadata,
                     q.recipient_email, c.name AS campaign_name
              FROM campaign_events e
              LEFT JOIN email_queue q ON q.id = e.queue_id
              LEFT JOIN campaigns c ON c.id = e.campaign_id
              WHERE e.event_type='bounce'
              ORDER BY e.occurred_at DESC LIMIT 8`,
          sql`SELECT e.id, e.occurred_at, e.metadata,
                     q.recipient_email, c.name AS campaign_name
              FROM campaign_events e
              LEFT JOIN email_queue q ON q.id = e.queue_id
              LEFT JOIN campaigns c ON c.id = e.campaign_id
              WHERE e.event_type='complaint'
              ORDER BY e.occurred_at DESC LIMIT 8`,
          sql`SELECT c.id, c.name, c.total_recipients,
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
          sql`SELECT
                (SELECT count(*)::int FROM sns_event_log) AS total,
                (SELECT count(*)::int FROM sns_event_log WHERE received_at >= now() - interval '24 hours') AS last_24h,
                (SELECT received_at FROM sns_event_log ORDER BY received_at DESC LIMIT 1) AS last_event_at,
                (SELECT event_type FROM sns_event_log ORDER BY received_at DESC LIMIT 1) AS last_event_type`,
          sql`SELECT id, name, provider, region, status, last_checked_at, is_default
              FROM email_providers ORDER BY is_default DESC, name`,
          sql`SELECT count(*)::int AS c FROM campaign_events WHERE event_type='unsubscribe'`,
        ]);

        const q: any = queueR[0];

        const payload = {
          metrics: {
            total_contacts: contactsR[0].c,
            total_lists: listsR[0].c,
            total_campaigns: campaignsR[0].total,
            draft_campaigns: campaignsR[0].draft,
            scheduled_campaigns: campaignsR[0].scheduled,
            sent_campaigns: campaignsR[0].sent,
            sending_campaigns: campaignsR[0].sending,
            emails_queued: q.queued + q.sending,
            emails_sent: q.sent,
            emails_delivered: q.delivered,
            emails_opened: q.opened,
            emails_clicked: q.clicked,
            failed_sends: q.failed,
            bounces: q.bounced,
            complaints: q.complained,
            unsubscribes: unsubR[0].c,
            suppressed_emails: suppressedR[0].c,
            delivery_rate: pct(q.delivered, q.sent),
            open_rate: pct(q.opened, q.delivered || q.sent),
            click_rate: pct(q.clicked, q.delivered || q.sent),
            bounce_rate: pct(q.bounced, q.sent),
            complaint_rate: pct(q.complained, q.sent),
          },
          sending_activity: activityR,
          recent_campaigns: recentCampaignsR,
          recent_events: recentEventsR.map((e: any) => ({
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
          recent_bounces: bouncesR.map((b: any) => ({
            id: b.id,
            recipient: b.recipient_email || b.metadata?.bouncedRecipients?.[0]?.emailAddress || null,
            campaign: b.campaign_name,
            type: b.metadata?.bounceType || null,
            at: b.occurred_at,
          })),
          recent_complaints: complaintsR.map((c: any) => ({
            id: c.id,
            recipient: c.recipient_email || c.metadata?.complainedRecipients?.[0]?.emailAddress || null,
            campaign: c.campaign_name,
            feedback_type: c.metadata?.complaintFeedbackType || null,
            at: c.occurred_at,
          })),
          top_campaigns: topCampaignsR.map((c: any) => ({
            id: c.id,
            name: c.name,
            sent: c.sent,
            opens: c.opens,
            clicks: c.clicks,
            open_rate: pct(c.opens, c.sent),
            click_rate: pct(c.clicks, c.sent),
          })),
          sns_health: snsR[0] || { total: 0, last_24h: 0, last_event_at: null, last_event_type: null },
          providers: providersR,
        };

        _cache = { at: Date.now(), payload };
        return json(payload);
        } catch (err) {
          console.error("[dashboard/summary] query failed", err);
          // Serve stale cache if we have any, so the dashboard never blanks out.
          if (_cache) return json({ ..._cache.payload, stale: true });
          return json({ error: "Dashboard data is temporarily unavailable" }, 503);

        }


      },
    },
  },
});
