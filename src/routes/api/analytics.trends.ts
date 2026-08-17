import { createFileRoute } from "@tanstack/react-router";
import { requireAuth, json } from "@/lib/server-auth";

const DAY = 24 * 60 * 60 * 1000;

export const Route = createFileRoute("/api/analytics/trends")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await requireAuth(request);
        if (auth instanceof Response) return auth;

        const url = new URL(request.url);
        const to = url.searchParams.get("to") || new Date().toISOString();
        const from =
          url.searchParams.get("from") || new Date(Date.now() - 30 * DAY).toISOString();
        const interval = url.searchParams.get("interval") === "hour" ? "hour" : "day";
        const campaignId = url.searchParams.get("campaign_id");

        const { db } = await import("@/lib/db.server");
        const sql = db();

        const rows = campaignId
          ? await sql`
              SELECT date_trunc(${interval}, occurred_at) AS bucket,
                count(*) FILTER (WHERE event_type='send')::int AS sent,
                count(*) FILTER (WHERE event_type='delivery')::int AS delivered,
                count(*) FILTER (WHERE event_type='open')::int AS opened,
                count(*) FILTER (WHERE event_type='click')::int AS clicked,
                count(*) FILTER (WHERE event_type='bounce')::int AS bounced,
                count(*) FILTER (WHERE event_type='complaint')::int AS complained,
                count(*) FILTER (WHERE event_type='unsubscribe')::int AS unsubscribed
              FROM campaign_events
              WHERE occurred_at >= ${from} AND occurred_at <= ${to}
                AND campaign_id = ${campaignId}
              GROUP BY 1 ORDER BY 1`
          : await sql`
              SELECT date_trunc(${interval}, occurred_at) AS bucket,
                count(*) FILTER (WHERE event_type='send')::int AS sent,
                count(*) FILTER (WHERE event_type='delivery')::int AS delivered,
                count(*) FILTER (WHERE event_type='open')::int AS opened,
                count(*) FILTER (WHERE event_type='click')::int AS clicked,
                count(*) FILTER (WHERE event_type='bounce')::int AS bounced,
                count(*) FILTER (WHERE event_type='complaint')::int AS complained,
                count(*) FILTER (WHERE event_type='unsubscribe')::int AS unsubscribed
              FROM campaign_events
              WHERE occurred_at >= ${from} AND occurred_at <= ${to}
              GROUP BY 1 ORDER BY 1`;

        return json({
          interval,
          points: rows.map((r: any) => ({
            bucket: r.bucket instanceof Date ? r.bucket.toISOString() : String(r.bucket),
            sent: r.sent,
            delivered: r.delivered,
            opened: r.opened,
            clicked: r.clicked,
            bounced: r.bounced,
            complained: r.complained,
            unsubscribed: r.unsubscribed,
          })),
        });
      },
    },
  },
});
