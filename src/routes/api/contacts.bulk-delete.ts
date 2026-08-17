import { createFileRoute } from "@tanstack/react-router";
import { requireAuth, json } from "@/lib/server-auth";

export const Route = createFileRoute("/api/contacts/bulk-delete")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await requireAuth(request);
        if (auth instanceof Response) return auth;
        const body = await request.json().catch(() => ({}));
        const ids: string[] = Array.isArray(body?.ids) ? body.ids : [];
        if (!ids.length) return json({ error: "No ids provided" }, 400);
        const { db } = await import("@/lib/db.server");
        const sql = db();
        await sql`DELETE FROM contacts WHERE id IN ${sql(ids)}`;
        return json({ ok: true, deleted: ids.length });
      },
    },
  },
});
