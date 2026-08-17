import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@/lib/server-auth";

function csvCell(v: any) {
  if (v == null) return "";
  const s = String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const Route = createFileRoute("/api/contacts/export.csv")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await requireAuth(request);
        if (auth instanceof Response) return auth;
        const url = new URL(request.url);
        const q = (url.searchParams.get("q") || "").trim().toLowerCase();
        const listId = (url.searchParams.get("list_id") || "").trim();
        const like = "%" + q + "%";
        const hasQ = q.length > 0;
        const hasList = listId.length > 0;

        const { db } = await import("@/lib/db.server");
        const sql = db();
        const rows = await sql`
          SELECT c.email, c.first_name, c.last_name, c.phone, c.company, c.job_title, c.award_category, c.status, c.created_at
          FROM contacts c
          WHERE 1=1
          ${hasQ ? sql`AND (lower(c.email) LIKE ${like} OR lower(coalesce(c.company,'')) LIKE ${like})` : sql``}
          ${hasList ? sql`AND EXISTS (SELECT 1 FROM contact_list_members m WHERE m.contact_id = c.id AND m.list_id = ${listId})` : sql``}
          ORDER BY c.created_at DESC`;

        const headers = ["EMAIL", "FIRSTNAME", "LASTNAME", "PHONE", "COMPANY", "JOB_TITLE", "AWARD_CATEGORY", "STATUS", "ADDED_AT"];
        const lines = [headers.join(",")];
        for (const r of rows as any[]) {
          lines.push([
            r.email, r.first_name, r.last_name, r.phone, r.company, r.job_title, r.award_category, r.status,
            r.created_at ? new Date(r.created_at).toISOString() : "",
          ].map(csvCell).join(","));
        }
        return new Response(lines.join("\n"), {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="contacts.csv"`,
          },
        });
      },
    },
  },
});
