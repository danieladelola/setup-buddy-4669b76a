import { createFileRoute } from "@tanstack/react-router";
import { requireAuth, json } from "@/lib/server-auth";

const pct = (n: number, d: number) => (d ? +((Number(n) / Number(d)) * 100).toFixed(2) : 0);

const DAY = 24 * 60 * 60 * 1000;

function parseRange(url: URL) {
  const to = url.searchParams.get("to") || new Date().toISOString();
  const from = url.searchParams.get("from") || new Date(Date.now() - 30 * DAY).toISOString();
  return { from, to };
}

export const Route = createFileRoute("/api/analytics/overview")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await requireAuth(request);
        if (auth instanceof Response) return auth;

        const url = new URL(request.url);
        const { from, to } = parseRange(url);
        const campaignId = url.searchParams.get("campaign_id");

        const { db } = await import("@/lib/db.server");
        const sql = db();

        const eventsR = campaignId
          ? await sql`
              SELECT
                count(*) FILTER (WHERE event_type='send')::int AS sent,
                count(*) FILTER (WHERE event_type='delivery')::int AS delivered,
                count(*) FILTER (WHERE event_type='open')::int AS opened,
                count(DISTINCT queue_id) FILTER (WHERE event_type='open')::int AS unique_opens,
                count(*) FILTER (WHERE event_type='click')::int AS clicked,
                count(DISTINCT queue_id) FILTER (WHERE event_type='click')::int AS unique_clicks,
                count(*) FILTER (WHERE event_type='bounce')::int AS bounced,
                count(*) FILTER (WHERE event_type='complaint')::int AS complained,
                count(*) FILTER (WHERE event_type='unsubscribe')::int AS unsubscribed,
                count(*) FILTER (WHERE event_type IN ('failed','reject','rendering_failure'))::int AS failed
              FROM campaign_events
              WHERE occurred_at >= ${from} AND occurred_at <= ${to}
                AND campaign_id = ${campaignId}`
          : await sql`
              SELECT
                count(*) FILTER (WHERE event_type='send')::int AS sent,
                count(*) FILTER (WHERE event_type='delivery')::int AS delivered,
                count(*) FILTER (WHERE event_type='open')::int AS opened,
                count(DISTINCT queue_id) FILTER (WHERE event_type='open')::int AS unique_opens,
                count(*) FILTER (WHERE event_type='click')::int AS clicked,
                count(DISTINCT queue_id) FILTER (WHERE event_type='click')::int AS unique_clicks,
                count(*) FILTER (WHERE event_type='bounce')::int AS bounced,
                count(*) FILTER (WHERE event_type='complaint')::int AS complained,
                count(*) FILTER (WHERE event_type='unsubscribe')::int AS unsubscribed,
                count(*) FILTER (WHERE event_type IN ('failed','reject','rendering_failure'))::int AS failed
              FROM campaign_events
              WHERE occurred_at >= ${from} AND occurred_at <= ${to}`;

        const [campaignsR, suppressedR] = await Promise.all([
          sql`SELECT count(*)::int AS c FROM campaigns
              WHERE created_at >= ${from} AND created_at <= ${to}`,
          sql`SELECT count(*)::int AS c FROM suppressed_emails
              WHERE created_at >= ${from} AND created_at <= ${to}`,
        ]);

        const e: any = eventsR[0];
        const denom = Number(e.delivered) || Number(e.sent) || 0;
        return json({
          range: { from, to },
          total_campaigns: campaignsR[0].c,
          suppressed_added: suppressedR[0].c,
          sent: e.sent,
          delivered: e.delivered,
          opened: e.opened,
          unique_opens: e.unique_opens,
          clicked: e.clicked,
          unique_clicks: e.unique_clicks,
          bounced: e.bounced,
          complained: e.complained,
          unsubscribed: e.unsubscribed,
          failed: e.failed,
          delivery_rate: pct(e.delivered, e.sent),
          open_rate: pct(e.unique_opens, denom),
          click_rate: pct(e.unique_clicks, denom),
          bounce_rate: pct(e.bounced, e.sent),
          complaint_rate: pct(e.complained, e.sent),
          unsubscribe_rate: pct(e.unsubscribed, denom),
        });
      },
    },
  },
});
