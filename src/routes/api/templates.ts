import { createFileRoute } from "@tanstack/react-router";
import { requireAuth, json } from "@/lib/server-auth";

export const Route = createFileRoute("/api/templates")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await requireAuth(request);
        if (auth instanceof Response) return auth;
        const { db } = await import("@/lib/db.server");
        const sql = db();
        const rows = await sql`
          SELECT id, name, subject, preview_text, from_name, status, tags,
                 created_at, updated_at
          FROM email_templates
          ORDER BY updated_at DESC`;
        return json({ data: rows });
      },
      POST: async ({ request }) => {
        const auth = await requireAuth(request);
        if (auth instanceof Response) return auth;
        const body = await request.json().catch(() => ({}));

        // Batch 5: Zod validation + HTML sanitization of html_body.
        const { templateCreateSchema, zerr } = await import("@/lib/validation");
        const { sanitizeEmailHtml } = await import("@/lib/sanitize.server");
        const parsed = templateCreateSchema.safeParse(body);
        if (!parsed.success) return json(zerr(parsed.error), 400);
        const v = parsed.data;
        const safeHtml = v.html_body ? sanitizeEmailHtml(v.html_body) : "";

        const { db } = await import("@/lib/db.server");
        const sql = db();
        const rows = await sql`
          INSERT INTO email_templates
            (name, subject, html_body, text_body, preview_text, from_name, status, tags, builder_json)
          VALUES (
            ${v.name},
            ${v.subject || v.name},
            ${safeHtml},
            ${v.text_body || null},
            ${v.preview_text || null},
            ${v.from_name || null},
            ${v.status || "draft"},
            ${v.tags || []},
            ${v.builder_json ? sql.json(v.builder_json as any) : null}
          )
          RETURNING *`;
        return json(rows[0]);
      },
    },
  },
});
