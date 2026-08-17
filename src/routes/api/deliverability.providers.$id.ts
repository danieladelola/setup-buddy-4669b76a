import { createFileRoute } from "@tanstack/react-router";
import { requireAuth, json } from "@/lib/server-auth";

export const Route = createFileRoute("/api/deliverability/providers/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const auth = await requireAuth(request);
        if (auth instanceof Response) return auth;

        const { db } = await import("@/lib/db.server");
        const sql = db();
        const rows = await sql`SELECT * FROM email_providers WHERE id = ${params.id} LIMIT 1`;
        if (!rows[0]) return json({ error: "Not found" }, 404);
        return json(rows[0]);
      },

      PUT: async ({ request, params }) => {
        const auth = await requireAuth(request);
        if (auth instanceof Response) return auth;

        const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
        const { db } = await import("@/lib/db.server");
        const sql = db();

        const allowed = [
          "name",
          "provider",
          "region",
          "from_email",
          "from_name",
          "configuration_set",
          "sns_topic_arn",
          "is_default",
          "status",
        ] as const;
        const patch: Record<string, unknown> = {};
        for (const k of allowed) if (k in body) patch[k] = (body as any)[k];
        if (Object.keys(patch).length === 0) return json({ error: "No fields to update" }, 400);

        const rows = await sql`
          UPDATE email_providers SET ${sql(patch)}, updated_at = now()
          WHERE id = ${params.id}
          RETURNING *`;
        if (!rows[0]) return json({ error: "Not found" }, 404);

        if (patch.is_default === true) {
          await sql`UPDATE email_providers SET is_default = false WHERE id <> ${params.id}`;
        }
        return json(rows[0]);
      },

      DELETE: async ({ request, params }) => {
        const auth = await requireAuth(request);
        if (auth instanceof Response) return auth;

        const { db } = await import("@/lib/db.server");
        const sql = db();
        const rows = await sql`DELETE FROM email_providers WHERE id = ${params.id} RETURNING id`;
        if (!rows[0]) return json({ error: "Not found" }, 404);
        return json({ ok: true });
      },
    },
  },
});
