import { createFileRoute } from "@tanstack/react-router";
import { requireAuth, json } from "@/lib/server-auth";

export const Route = createFileRoute("/api/contacts/$id")({
  server: {
    handlers: {
      PUT: async ({ request, params }) => {
        const auth = await requireAuth(request);
        if (auth instanceof Response) return auth;
        const body = await request.json().catch(() => ({}));
        const fields: Record<string, any> = {};
        for (const k of ["first_name", "last_name", "phone", "company", "job_title", "award_category", "status", "source", "notes"]) {
          if (k in body) fields[k] = body[k] === "" ? null : body[k];
        }
        if (body?.email) fields.email = String(body.email).toLowerCase().trim();
        fields.updated_at = new Date();

        const { db } = await import("@/lib/db.server");
        const sql = db();
        const rows = await sql`
          UPDATE contacts SET ${sql(fields)} WHERE id = ${params.id}
          RETURNING id, email, first_name, last_name, phone, company, job_title, award_category, status, source, notes, unsubscribed, created_at, updated_at`;
        if (!rows.length) return json({ error: "Not found" }, 404);

        if (Array.isArray(body?.list_ids)) {
          await sql`DELETE FROM contact_list_members WHERE contact_id = ${params.id}`;
          for (const lid of body.list_ids) {
            await sql`INSERT INTO contact_list_members (list_id, contact_id) VALUES (${lid}, ${params.id}) ON CONFLICT DO NOTHING`;
          }
        }
        return json(rows[0]);
      },
      DELETE: async ({ request, params }) => {
        const auth = await requireAuth(request);
        if (auth instanceof Response) return auth;
        const { db } = await import("@/lib/db.server");
        const sql = db();
        await sql`DELETE FROM contacts WHERE id = ${params.id}`;
        return json({ ok: true });
      },
    },
  },
});
