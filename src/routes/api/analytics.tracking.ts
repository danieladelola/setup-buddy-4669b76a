import { createFileRoute } from "@tanstack/react-router";
import { requireAuth, json } from "@/lib/server-auth";

const DAY = 24 * 60 * 60 * 1000;

export const Route = createFileRoute("/api/analytics/tracking")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await requireAuth(request);
        if (auth instanceof Response) return auth;

        const url = new URL(request.url);
        const to = url.searchParams.get("to") || new Date().toISOString();
        const from =
          url.searchParams.get("from") || new Date(Date.now() - 30 * DAY).toISOString();
        const type = url.searchParams.get("type"); // open | click | null
        const campaignId = url.searchParams.get("campaign_id");
        const limit = Math.min(
          parseInt(url.searchParams.get("limit") || "200", 10) || 200,
          1000,
        );

        const { db } = await import("@/lib/db.server");
        const sql = db();

        const typeFilter = type === "open" || type === "click" ? [type] : ["open", "click"];

        const rows = campaignId
          ? await sql`
              SELECT e.id, e.campaign_id, c.name AS campaign_name, e.queue_id,
                e.event_type, q.recipient_email,
                COALESCE(e.metadata->>'url', e.metadata->>'link') AS link_url,
                e.metadata->>'user_agent' AS user_agent,
                e.metadata->>'ip' AS ip_address,
                e.occurred_at
              FROM campaign_events e
              LEFT JOIN email_queue q ON q.id = e.queue_id
              LEFT JOIN campaigns c ON c.id = e.campaign_id
              WHERE e.event_type IN ${sql(typeFilter)}
                AND e.occurred_at >= ${from} AND e.occurred_at <= ${to}
                AND e.campaign_id = ${campaignId}
              ORDER BY e.occurred_at DESC LIMIT ${limit}`
          : await sql`
              SELECT e.id, e.campaign_id, c.name AS campaign_name, e.queue_id,
                e.event_type, q.recipient_email,
                COALESCE(e.metadata->>'url', e.metadata->>'link') AS link_url,
                e.metadata->>'user_agent' AS user_agent,
                e.metadata->>'ip' AS ip_address,
                e.occurred_at
              FROM campaign_events e
              LEFT JOIN email_queue q ON q.id = e.queue_id
              LEFT JOIN campaigns c ON c.id = e.campaign_id
              WHERE e.event_type IN ${sql(typeFilter)}
                AND e.occurred_at >= ${from} AND e.occurred_at <= ${to}
              ORDER BY e.occurred_at DESC LIMIT ${limit}`;

        return json({ items: rows });
      },
    },
  },
});
