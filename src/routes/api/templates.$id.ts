import { createFileRoute } from "@tanstack/react-router";
import { requireAuth, json } from "@/lib/server-auth";

export const Route = createFileRoute("/api/templates/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const auth = await requireAuth(request);
        if (auth instanceof Response) return auth;
        const { db } = await import("@/lib/db.server");
        const sql = db();
        const rows = await sql`SELECT * FROM email_templates WHERE id = ${params.id}`;
        return json(rows[0] || null);
      },
      PUT: async ({ request, params }) => {
        const auth = await requireAuth(request);
        if (auth instanceof Response) return auth;
        const body = await request.json().catch(() => ({}));

        // Batch 5: validate + sanitize.
        const { templateUpdateSchema, zerr } = await import("@/lib/validation");
        const { sanitizeEmailHtml } = await import("@/lib/sanitize.server");
        const parsed = templateUpdateSchema.safeParse(body);
        if (!parsed.success) return json(zerr(parsed.error), 400);
        const v: any = parsed.data;

        const { db } = await import("@/lib/db.server");
        const sql = db();

        const patch: Record<string, any> = {};
        for (const k of ["name", "subject", "text_body", "preview_text", "from_name", "status"]) {
          if (k in v && v[k] !== undefined) patch[k] = v[k];
        }
        if (v.html_body !== undefined) patch.html_body = sanitizeEmailHtml(v.html_body);
        if (v.tags !== undefined) patch.tags = v.tags || [];
        if (v.builder_json !== undefined) {
          patch.builder_json = v.builder_json ? sql.json(v.builder_json as any) : null;
        }
        patch.updated_at = new Date();

        if (Object.keys(patch).length === 1) {
          const rows = await sql`SELECT * FROM email_templates WHERE id = ${params.id}`;
          return json(rows[0] || null);
        }

        const rows = await sql`
          UPDATE email_templates SET ${sql(patch)} WHERE id = ${params.id} RETURNING *`;
        return json(rows[0] || null);
      },
      DELETE: async ({ request, params }) => {
        const auth = await requireAuth(request);
        if (auth instanceof Response) return auth;
        const { db } = await import("@/lib/db.server");
        const sql = db();
        await sql`DELETE FROM email_templates WHERE id = ${params.id}`;
        return json({ ok: true });
      },
    },
  },
});
