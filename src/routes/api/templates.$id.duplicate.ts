import { createFileRoute } from "@tanstack/react-router";
import { requireAuth, json } from "@/lib/server-auth";

export const Route = createFileRoute("/api/templates/$id/duplicate")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const auth = await requireAuth(request);
        if (auth instanceof Response) return auth;
        const { db } = await import("@/lib/db.server");
        const sql = db();
        const rows = await sql`
          INSERT INTO email_templates
            (name, subject, html_body, text_body, preview_text, from_name, status, tags, builder_json)
          SELECT name || ' (copy)', subject, html_body, text_body, preview_text, from_name, 'draft', tags, builder_json
          FROM email_templates WHERE id = ${params.id}
          RETURNING *`;
        if (!rows.length) return json({ error: "Not found" }, 404);
        return json(rows[0]);
      },
    },
  },
});
