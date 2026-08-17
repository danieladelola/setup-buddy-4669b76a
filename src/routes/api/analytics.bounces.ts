import { createFileRoute } from "@tanstack/react-router";
import { requireAuth, json } from "@/lib/server-auth";

const DAY = 24 * 60 * 60 * 1000;

export const Route = createFileRoute("/api/analytics/bounces")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await requireAuth(request);
        if (auth instanceof Response) return auth;

        const url = new URL(request.url);
        const to = url.searchParams.get("to") || new Date().toISOString();
        const from =
          url.searchParams.get("from") || new Date(Date.now() - 30 * DAY).toISOString();
        const limit = Math.min(
          parseInt(url.searchParams.get("limit") || "200", 10) || 200,
          1000,
        );

        const { db } = await import("@/lib/db.server");
        const sql = db();

        const rows = await sql`
          SELECT e.id, e.campaign_id, c.name AS campaign_name,
            COALESCE(
              q.recipient_email,
              e.metadata#>>'{bouncedRecipients,0,emailAddress}'
            ) AS recipient_email,
            e.metadata->>'bounceType' AS bounce_type,
            e.metadata->>'bounceSubType' AS bounce_subtype,
            COALESCE(
              e.metadata#>>'{bouncedRecipients,0,diagnosticCode}',
              e.metadata->>'reason'
            ) AS reason,
            e.metadata#>>'{mail,messageId}' AS provider_message_id,
            e.occurred_at
          FROM campaign_events e
          LEFT JOIN email_queue q ON q.id = e.queue_id
          LEFT JOIN campaigns c ON c.id = e.campaign_id
          WHERE e.event_type='bounce'
            AND e.occurred_at >= ${from} AND e.occurred_at <= ${to}
          ORDER BY e.occurred_at DESC LIMIT ${limit}`;

        return json({ items: rows });
      },
    },
  },
});
