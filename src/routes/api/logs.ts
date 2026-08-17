import { createFileRoute } from "@tanstack/react-router";
import { requireAuth, json } from "@/lib/server-auth";

export const Route = createFileRoute("/api/logs")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await requireAuth(request);
        if (auth instanceof Response) return auth;
        const { db } = await import("@/lib/db.server");
        const sql = db();
        const url = new URL(request.url);
        const action = (url.searchParams.get("action") || "").trim();
        const entity = (url.searchParams.get("entity_type") || "").trim();
        const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get("limit") || "50", 10)));
        const offset = Math.max(0, parseInt(url.searchParams.get("offset") || "0", 10));

        const where = sql`
          WHERE 1=1
          ${action ? sql`AND action = ${action}` : sql``}
          ${entity ? sql`AND entity_type = ${entity}` : sql``}
        `;

        const [{ count }] = await sql`SELECT count(*)::int AS count FROM audit_log ${where}`;
        const rows = await sql`
          SELECT id, actor_id, actor_email, action, entity_type, entity_id, metadata, ip, created_at
          FROM audit_log ${where}
          ORDER BY created_at DESC
          LIMIT ${limit} OFFSET ${offset}`;
        return json({ data: rows, total: count, limit, offset });
      },
    },
  },
});
