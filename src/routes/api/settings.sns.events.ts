import { createFileRoute } from "@tanstack/react-router";
import { requireAuth, json } from "@/lib/server-auth";

export const Route = createFileRoute("/api/settings/sns/events")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await requireAuth(request);
        if (auth instanceof Response) return auth;

        const url = new URL(request.url);
        const limit = Math.min(
          parseInt(url.searchParams.get("limit") || "50", 10) || 50,
          500,
        );
        const offset = Math.max(parseInt(url.searchParams.get("offset") || "0", 10) || 0, 0);
        const eventType = url.searchParams.get("event_type");

        const { db } = await import("@/lib/db.server");
        const sql = db();

        const events = eventType
          ? await sql`
              SELECT id, message_id, event_type, received_at,
                raw->>'TopicArn' AS topic_arn,
                raw->>'Subject' AS subject
              FROM sns_event_log
              WHERE event_type = ${eventType}
              ORDER BY received_at DESC
              LIMIT ${limit} OFFSET ${offset}`
          : await sql`
              SELECT id, message_id, event_type, received_at,
                raw->>'TopicArn' AS topic_arn,
                raw->>'Subject' AS subject
              FROM sns_event_log
              ORDER BY received_at DESC
              LIMIT ${limit} OFFSET ${offset}`;

        const totalR = eventType
          ? await sql`SELECT count(*)::int AS c FROM sns_event_log WHERE event_type = ${eventType}`
          : await sql`SELECT count(*)::int AS c FROM sns_event_log`;

        return json({ events, total: totalR[0].c, limit, offset });
      },
    },
  },
});
