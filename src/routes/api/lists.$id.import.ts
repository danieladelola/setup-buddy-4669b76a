import { createFileRoute } from "@tanstack/react-router";
import { requireAuth, json } from "@/lib/server-auth";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BATCH = 1000;

export const Route = createFileRoute("/api/lists/$id/import")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const auth = await requireAuth(request);
        if (auth instanceof Response) return auth;
        const body = await request.json().catch(() => ({}));
        const rows: any[] = Array.isArray(body?.rows) ? body.rows : [];
        if (!rows.length) return json({ error: "No rows provided" }, 400);

        const { db } = await import("@/lib/db.server");
        const sql = db();

        const listExists = await sql`SELECT id FROM contact_lists WHERE id = ${params.id}`;
        if (!listExists.length) return json({ error: "List not found" }, 404);

        const seen = new Set<string>();
        const clean: any[] = [];
        let invalid = 0, duplicates = 0;

        for (const r of rows) {
          const email = String(r?.email || "").trim().toLowerCase();
          if (!email || !EMAIL_RE.test(email) || email.length > 254) { invalid++; continue; }
          if (seen.has(email)) { duplicates++; continue; }
          seen.add(email);
          clean.push({
            email,
            first_name: r?.first_name ? String(r.first_name).trim().slice(0, 120) : null,
            last_name: r?.last_name ? String(r.last_name).trim().slice(0, 120) : null,
            phone: r?.phone ? String(r.phone).trim().slice(0, 60) : null,
            company: r?.company ? String(r.company).trim().slice(0, 180) : null,
            job_title: r?.job_title ? String(r.job_title).trim().slice(0, 180) : null,
            source: "list-import",
          });
        }

        let inserted = 0, updated = 0, linked = 0;

        for (let i = 0; i < clean.length; i += BATCH) {
          const chunk = clean.slice(i, i + BATCH);
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

          if (res.length) {
            const links = res.map((r: any) => ({ list_id: params.id, contact_id: r.id }));
            const linkRes = await sql`
              INSERT INTO contact_list_members ${(sql as any)(links, "list_id", "contact_id")}
              ON CONFLICT DO NOTHING
              RETURNING contact_id`;
            linked += linkRes.length;
          }
        }

        return json({
          total: rows.length,
          inserted, updated, invalid, duplicates, linked,
        });
      },
    },
  },
});
