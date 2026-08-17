import { createFileRoute } from "@tanstack/react-router";
import { requireAuth, json } from "@/lib/server-auth";

const DAY = 24 * 60 * 60 * 1000;

export const Route = createFileRoute("/api/analytics/top-links")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await requireAuth(request);
        if (auth instanceof Response) return auth;

        const url = new URL(request.url);
        const to = url.searchParams.get("to") || new Date().toISOString();
        const from =
          url.searchParams.get("from") || new Date(Date.now() - 30 * DAY).toISOString();
        const campaignId = url.searchParams.get("campaign_id");

        const { db } = await import("@/lib/db.server");
        const sql = db();

        const rows = campaignId
          ? await sql`
              SELECT COALESCE(metadata->>'url', metadata->>'link') AS url,
                count(*)::int AS clicks,
                count(DISTINCT queue_id)::int AS unique_clicks
              FROM campaign_events
              WHERE event_type='click'
                AND occurred_at >= ${from} AND occurred_at <= ${to}
                AND campaign_id = ${campaignId}
                AND COALESCE(metadata->>'url', metadata->>'link') IS NOT NULL
              GROUP BY 1 ORDER BY 2 DESC LIMIT 25`
          : await sql`
              SELECT COALESCE(metadata->>'url', metadata->>'link') AS url,
                count(*)::int AS clicks,
                count(DISTINCT queue_id)::int AS unique_clicks
              FROM campaign_events
              WHERE event_type='click'
                AND occurred_at >= ${from} AND occurred_at <= ${to}
                AND COALESCE(metadata->>'url', metadata->>'link') IS NOT NULL
              GROUP BY 1 ORDER BY 2 DESC LIMIT 25`;

        return json({ items: rows });
      },
    },
  },
});
