import { createFileRoute } from "@tanstack/react-router";
import { requireAuth, json } from "@/lib/server-auth";

const DAY = 24 * 60 * 60 * 1000;
const pct = (n: number, d: number) => (d ? +((Number(n) / Number(d)) * 100).toFixed(2) : 0);

export const Route = createFileRoute("/api/analytics/campaigns")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await requireAuth(request);
        if (auth instanceof Response) return auth;

        const url = new URL(request.url);
        const to = url.searchParams.get("to") || new Date().toISOString();
        const from =
          url.searchParams.get("from") || new Date(Date.now() - 90 * DAY).toISOString();

        const { db } = await import("@/lib/db.server");
        const sql = db();

        const rows = await sql`
          SELECT c.id, c.name, c.status, c.from_email, c.from_name, c.total_recipients,
            c.started_at, c.finished_at, c.created_at,
            count(q.*) FILTER (WHERE q.status IN ('sent','delivered','opened','clicked','bounced','complained'))::int AS sent,
            count(q.*) FILTER (WHERE q.delivered_at IS NOT NULL)::int AS delivered,
            count(q.*) FILTER (WHERE q.opened_at IS NOT NULL)::int AS opens,
            count(q.*) FILTER (WHERE q.opened_at IS NOT NULL)::int AS unique_opens,
            count(q.*) FILTER (WHERE q.clicked_at IS NOT NULL)::int AS clicks,
            count(q.*) FILTER (WHERE q.clicked_at IS NOT NULL)::int AS unique_clicks,
            count(q.*) FILTER (WHERE q.bounced_at IS NOT NULL)::int AS bounced,
            count(q.*) FILTER (WHERE q.complained_at IS NOT NULL)::int AS complained,
            (SELECT count(*)::int FROM campaign_events e
              WHERE e.campaign_id = c.id AND e.event_type = 'unsubscribe') AS unsubscribed,
            count(q.*) FILTER (WHERE q.status='failed')::int AS failed
          FROM campaigns c
          LEFT JOIN email_queue q ON q.campaign_id = c.id
          WHERE c.created_at >= ${from} AND c.created_at <= ${to}
          GROUP BY c.id
          ORDER BY c.created_at DESC`;

        const items = rows.map((r: any) => ({
          id: r.id,
          name: r.name,
          status: r.status,
          from_email: r.from_email,
          from_name: r.from_name,
          total_recipients: r.total_recipients,
          started_at: r.started_at,
          finished_at: r.finished_at,
          created_at: r.created_at,
          sent: r.sent,
          delivered: r.delivered,
          opens: r.opens,
          unique_opens: r.unique_opens,
          clicks: r.clicks,
          unique_clicks: r.unique_clicks,
          bounced: r.bounced,
          complained: r.complained,
          unsubscribed: r.unsubscribed,
          failed: r.failed,
          delivery_rate: pct(r.delivered, r.sent),
          open_rate: pct(r.unique_opens, r.delivered || r.sent),
          click_rate: pct(r.unique_clicks, r.delivered || r.sent),
          bounce_rate: pct(r.bounced, r.sent),
          complaint_rate: pct(r.complained, r.sent),
        }));

        return json({ items });
      },
    },
  },
});
