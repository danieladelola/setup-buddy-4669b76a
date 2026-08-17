import { createFileRoute } from "@tanstack/react-router";
import { requireAuth, json } from "@/lib/server-auth";
import { parseContacts } from "@/lib/parseContacts";

const BATCH = 1000;

export const Route = createFileRoute("/api/contacts/import")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await requireAuth(request);
        if (auth instanceof Response) return auth;
        const form = await request.formData();
        const file = form.get("file");
        const listId = (form.get("list_id") as string) || "";
        if (!(file instanceof File)) return json({ error: "file required" }, 400);
        if (file.size > 25 * 1024 * 1024) return json({ error: "file too large" }, 413);

        const text = await file.text();
        const parsed = parseContacts(text);

        const { db } = await import("@/lib/db.server");
        const sql = db();

        if (listId) {
          const exists = await sql`SELECT id FROM contact_lists WHERE id = ${listId}`;
          if (!exists.length) return json({ error: "List not found" }, 404);
        }

        const rows = parsed.valid.map((r) => ({
          email: r.email,
          first_name: r.first_name || null,
          last_name: r.last_name || null,
          phone: r.phone || null,
          company: r.company || null,
          job_title: r.job_title || null,
          source: "csv-import",
        }));

        let inserted = 0, updated = 0, linked = 0;

        for (let i = 0; i < rows.length; i += BATCH) {
          const chunk = rows.slice(i, i + BATCH);
          const res = await sql`
            INSERT INTO contacts ${(sql as any)(chunk, "email", "first_name", "last_name", "phone", "company", "job_title", "source")}
            ON CONFLICT (email) DO UPDATE SET
              first_name = COALESCE(EXCLUDED.first_name, contacts.first_name),
              last_name  = COALESCE(EXCLUDED.last_name,  contacts.last_name),
              phone      = COALESCE(EXCLUDED.phone,      contacts.phone),
              company    = COALESCE(EXCLUDED.company,    contacts.company),
              job_title  = COALESCE(EXCLUDED.job_title,  contacts.job_title),
              updated_at = now()
            RETURNING id, (xmax = 0) AS inserted`;

          for (const r of res) {
            if (r.inserted) inserted++; else updated++;
          }

          if (listId && res.length) {
            const links = res.map((r: any) => ({ list_id: listId, contact_id: r.id }));
            const linkRes = await sql`
              INSERT INTO contact_list_members ${(sql as any)(links, "list_id", "contact_id")}
              ON CONFLICT DO NOTHING
              RETURNING contact_id`;
            linked += linkRes.length;
          }
        }

        return json({
          total: parsed.valid.length + parsed.invalid.length + parsed.duplicates,
          inserted, updated, linked,
          duplicates: parsed.duplicates,
          invalid: parsed.invalid.length,
        });
      },
    },
  },
});
