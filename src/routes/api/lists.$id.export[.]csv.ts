import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@/lib/server-auth";

function csvEscape(v: any): string {
  if (v == null) return "";
  const s = String(v);
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export const Route = createFileRoute("/api/lists/$id/export.csv")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const auth = await requireAuth(request);
        if (auth instanceof Response) return auth;
        const { db } = await import("@/lib/db.server");
        const sql = db();
        const rows = await sql`
          SELECT c.email, c.first_name, c.last_name, c.phone, c.company, c.job_title, c.status, m.added_at
          FROM contact_list_members m JOIN contacts c ON c.id = m.contact_id
          WHERE m.list_id = ${params.id} ORDER BY m.added_at DESC`;
        const header = ["email","first_name","last_name","phone","company","job_title","status","added_at"];
        const lines = [header.join(",")];
        for (const r of rows) lines.push(header.map((h) => csvEscape((r as any)[h])).join(","));
        return new Response(lines.join("\n"), {
          headers: {
            "Content-Type": "text/csv",
            "Content-Disposition": `attachment; filename="list-${params.id}.csv"`,
          },
        });
      },
    },
  },
});
