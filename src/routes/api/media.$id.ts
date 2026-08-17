import { createFileRoute } from "@tanstack/react-router";
import { requireAuth, json } from "@/lib/server-auth";

export const Route = createFileRoute("/api/media/$id")({
  server: {
    handlers: {
      DELETE: async ({ request, params }) => {
        const auth = await requireAuth(request);
        if (auth instanceof Response) return auth;
        const { db } = await import("@/lib/db.server");
        const sql = db();
        const rows = await sql`
          DELETE FROM media_assets WHERE id = ${params.id}
          RETURNING id, filename`;
        if (!rows.length) return json({ error: "Not found" }, 404);
        const { audit } = await import("@/lib/audit.server");
        await audit(auth, {
          action: "media.delete",
          entity_type: "media",
          entity_id: rows[0].id,
          metadata: { filename: rows[0].filename },
        }, request);
        return json({ ok: true });
      },
    },
  },
});
