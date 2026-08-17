import { createFileRoute } from "@tanstack/react-router";
import { requireAuth, json } from "@/lib/server-auth";

export const Route = createFileRoute("/api/settings/ses")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await requireAuth(request);
        if (auth instanceof Response) return auth;
        const { getSesConfig } = await import("@/lib/ses.server");
        const { db } = await import("@/lib/db.server");
        const cfg = getSesConfig();
        let lastSnsEvent = null;
        try {
          const sql = db();
          const rows = await sql<{ received_at: Date; event_type: string; message_id: string }[]>`
            SELECT received_at, event_type, message_id FROM sns_event_log
            ORDER BY received_at DESC LIMIT 1`;
          lastSnsEvent = rows[0] || null;
        } catch {}
        return json({ ...cfg, lastSnsEvent });
      },
    },
  },
});
