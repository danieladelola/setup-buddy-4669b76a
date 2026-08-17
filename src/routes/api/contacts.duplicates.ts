// Batch 4: Admin-only diagnostic. Reports contacts whose email addresses
// collide under lower(email) but exist as distinct rows. Read-only: this
// endpoint does NOT merge or delete anything — operators decide.
//
// Backed by the contacts_lower_email_idx index (Batch 4 migration).
import { createFileRoute } from "@tanstack/react-router";
import { requireAuth, json } from "@/lib/server-auth";

export const Route = createFileRoute("/api/contacts/duplicates")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await requireAuth(request);
        if (auth instanceof Response) return auth;

        const url = new URL(request.url);
        const limit = Math.min(
          500,
          Math.max(1, parseInt(url.searchParams.get("limit") || "100", 10)),
        );

        const { db } = await import("@/lib/db.server");
        const sql = db();

        const rows = await sql<
          {
            normalized_email: string;
            count: number;
            contact_ids: string[];
            emails: string[];
            created_dates: string[];
          }[]
        >`
          SELECT
            lower(email)              AS normalized_email,
            count(*)::int             AS count,
            array_agg(id ORDER BY created_at) AS contact_ids,
            array_agg(email ORDER BY created_at) AS emails,
            array_agg(created_at ORDER BY created_at) AS created_dates
          FROM contacts
          GROUP BY lower(email)
          HAVING count(*) > 1
          ORDER BY count(*) DESC, lower(email) ASC
          LIMIT ${limit}
        `;

        const totalGroups = rows.length;
        const totalDuplicateRows = rows.reduce((s, r) => s + (r.count - 1), 0);

        return json({
          groups: rows,
          summary: {
            duplicate_groups: totalGroups,
            extra_rows: totalDuplicateRows,
            note: "Read-only diagnostic. No automatic merge.",
          },
        });
      },
    },
  },
});
