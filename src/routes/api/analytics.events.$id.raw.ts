import { createFileRoute } from "@tanstack/react-router";
import { requireAuth, json } from "@/lib/server-auth";

export const Route = createFileRoute("/api/analytics/events/$id/raw")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const auth = await requireAuth(request);
        if (auth instanceof Response) return auth;

        const id = Number(params.id);
        if (!Number.isFinite(id)) return json({ error: "Invalid event id" }, 400);

        const { db } = await import("@/lib/db.server");
        const sql = db();
        const rows = await sql`
          SELECT e.id, e.campaign_id, c.name AS campaign_name, e.queue_id,
            q.recipient_email, q.ses_message_id,
            e.event_type, e.metadata, e.occurred_at
          FROM campaign_events e
          LEFT JOIN email_queue q ON q.id = e.queue_id
          LEFT JOIN campaigns c ON c.id = e.campaign_id
          WHERE e.id = ${id} LIMIT 1`;

        if (!rows[0]) return json({ error: "Not found" }, 404);
        return json(rows[0]);
      },
    },
  },
});
