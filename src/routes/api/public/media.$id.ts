// Public read endpoint for media assets. Used in email templates so recipients'
// mail clients can fetch images without an auth header. IDs are unguessable
// UUIDs and the route is read-only.
import { createFileRoute } from "@tanstack/react-router";
import { checkRateLimit, clientIp, rateLimitResponse } from "@/lib/rate-limit.server";

export const Route = createFileRoute("/api/public/media/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const gate = checkRateLimit(`media.get:${clientIp(request)}`, {
          limit: 600,
          windowMs: 60_000,
        });
        if (!gate.ok) return rateLimitResponse(gate);

        const { db } = await import("@/lib/db.server");
        const sql = db();
        const rows = await sql<{ data: Buffer; mime_type: string; size_bytes: number }[]>`
          SELECT data, mime_type, size_bytes FROM media_assets WHERE id = ${params.id}`;
        if (!rows.length) return new Response("Not Found", { status: 404 });
        const row = rows[0];
        // postgres lib returns bytea as Buffer
        const body = row.data instanceof Buffer ? row.data : Buffer.from(row.data as any);
        return new Response(body, {
          status: 200,
          headers: {
            "Content-Type": row.mime_type || "application/octet-stream",
            "Content-Length": String(row.size_bytes),
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
      },
    },
  },
});
