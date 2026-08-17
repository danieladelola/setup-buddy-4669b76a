import { createFileRoute } from "@tanstack/react-router";
import { requireAuth, json } from "@/lib/server-auth";

export const Route = createFileRoute("/api/lists/$id/members/$contactId")({
  server: {
    handlers: {
      DELETE: async ({ request, params }) => {
        const auth = await requireAuth(request);
        if (auth instanceof Response) return auth;
        const { db } = await import("@/lib/db.server");
        const sql = db();
        await sql`DELETE FROM contact_list_members WHERE list_id = ${params.id} AND contact_id = ${params.contactId}`;
        return json({ ok: true });
      },
    },
  },
});
