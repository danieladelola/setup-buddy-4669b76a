import { createFileRoute } from "@tanstack/react-router";
import { requireAuth, json } from "@/lib/server-auth";

export const Route = createFileRoute("/api/campaigns/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const auth = await requireAuth(request);
        if (auth instanceof Response) return auth;
        const { db } = await import("@/lib/db.server");
        const sql = db();
        const rows = await sql<any[]>`SELECT * FROM campaigns WHERE id = ${params.id}`;
        const c = rows[0];
        if (!c) return json(null);
        // For drafts/scheduled, compute live deliverable audience size from
        // the assigned lists so the UI shows recipient counts before sending.
        if (["draft", "scheduled"].includes(c.status) && (!c.total_recipients || c.total_recipients === 0)) {
          const lists: string[] = Array.isArray(c.list_ids) && c.list_ids.length > 0
            ? c.list_ids.filter(Boolean)
            : [c.list_id].filter(Boolean);
          if (lists.length > 0) {
            const r = await sql<{ count: number }[]>`
              SELECT COUNT(DISTINCT m.contact_id)::int AS count
              FROM contact_list_members m
              JOIN contacts ct ON ct.id = m.contact_id
              WHERE m.list_id = ANY(${lists}::uuid[])
                AND ct.unsubscribed = false
                AND NOT EXISTS (SELECT 1 FROM suppressed_emails s WHERE s.email = lower(ct.email))`;
            c.total_recipients = r[0]?.count ?? 0;
          }
        }
        return json(c);
      },
      PUT: async ({ request, params }) => {
        const auth = await requireAuth(request);
        if (auth instanceof Response) return auth;
        const { db } = await import("@/lib/db.server");
        const b = await request.json().catch(() => ({}));
        const sql = db();
        // Multi-list update: when list_ids is provided, replace both the
        // array column and the legacy list_id (primary = first selection).
        const listIds: string[] | null = Array.isArray(b.list_ids)
          ? b.list_ids.filter((x: unknown) => typeof x === "string")
          : null;
        const primaryList = listIds && listIds.length > 0 ? listIds[0] : (b.list_id ?? null);
        const rows = await sql`
          UPDATE campaigns SET
            name = COALESCE(${b.name ?? null}, name),
            template_id = COALESCE(${b.template_id ?? null}, template_id),
            list_id = COALESCE(${primaryList}, list_id),
            list_ids = COALESCE(${listIds as any}, list_ids),
            subject = COALESCE(${b.subject ?? null}, subject),
            html_body = COALESCE(${b.html_body ?? null}, html_body),
            text_body = COALESCE(${b.text_body ?? null}, text_body),
            from_email = COALESCE(${b.from_email ?? null}, from_email),
            from_name = COALESCE(${b.from_name ?? null}, from_name),
            reply_to = COALESCE(${b.reply_to ?? null}, reply_to),
            provider = COALESCE(${b.provider ?? null}, provider),
            scheduled_at = COALESCE(${b.scheduled_at ?? null}, scheduled_at),
            updated_at = now()
          WHERE id = ${params.id} AND status IN ('draft','scheduled')
          RETURNING *`;
        return json(rows[0] || null);
      },
      DELETE: async ({ request, params }) => {
        const auth = await requireAuth(request);
        if (auth instanceof Response) return auth;
        const { db } = await import("@/lib/db.server");
        const sql = db();
        await sql`DELETE FROM campaigns WHERE id = ${params.id} AND status IN ('draft','scheduled','cancelled')`;
        return json({ ok: true });
      },
    },
  },
});
