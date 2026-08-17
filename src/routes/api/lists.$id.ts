import { createFileRoute } from "@tanstack/react-router";
import { requireAuth, json } from "@/lib/server-auth";

export const Route = createFileRoute("/api/lists/$id")({
  server: {
    handlers: {
      PUT: async ({ request, params }) => {
        const auth = await requireAuth(request);
        if (auth instanceof Response) return auth;
        const body = await request.json().catch(() => ({}));
        const { db } = await import("@/lib/db.server");
        const sql = db();
        try {
          if (body.name !== undefined && body.description !== undefined) {
            const r = await sql`UPDATE contact_lists SET name = ${body.name}, description = ${body.description} WHERE id = ${params.id} RETURNING *`;
            return json(r[0] || null);
          }
          if (body.name !== undefined) {
            const r = await sql`UPDATE contact_lists SET name = ${body.name} WHERE id = ${params.id} RETURNING *`;
            return json(r[0] || null);
          }
          if (body.description !== undefined) {
            const r = await sql`UPDATE contact_lists SET description = ${body.description} WHERE id = ${params.id} RETURNING *`;
            return json(r[0] || null);
          }
          return json({ ok: true });
        } catch (e: any) {
          if (e?.code === "23505") return json({ error: "A list with that name already exists" }, 409);
          return json({ error: "Update failed" }, 500);
        }
      },
      DELETE: async ({ request, params }) => {
        const auth = await requireAuth(request);
        if (auth instanceof Response) return auth;
        const { db } = await import("@/lib/db.server");
        const sql = db();
        await sql`DELETE FROM contact_lists WHERE id = ${params.id}`;
        return json({ ok: true });
      },
    },
  },
});
