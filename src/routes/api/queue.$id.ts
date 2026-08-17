import { createFileRoute } from "@tanstack/react-router";
import { requireAuth, json } from "@/lib/server-auth";

export const Route = createFileRoute("/api/queue/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const auth = await requireAuth(request);
        if (auth instanceof Response) return auth;
        const { db } = await import("@/lib/db.server");
        const sql = db();
        const rows = await sql<any[]>`
          SELECT q.*, c.name AS campaign_name, c.subject AS campaign_subject
          FROM email_queue q
          LEFT JOIN campaigns c ON c.id = q.campaign_id
          WHERE q.id = ${params.id}`;
        if (!rows[0]) return json({ error: "Not found" }, 404);
        const events = await sql<any[]>`
          SELECT id, event_type, metadata, occurred_at
          FROM campaign_events WHERE queue_id = ${params.id}
          ORDER BY occurred_at DESC LIMIT 100`;
        return json({ row: rows[0], events });
      },
    },
  },
});
