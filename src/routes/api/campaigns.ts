import { createFileRoute } from "@tanstack/react-router";
import { requireAuth, json } from "@/lib/server-auth";

export const Route = createFileRoute("/api/campaigns")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await requireAuth(request);
        if (auth instanceof Response) return auth;
        const { db } = await import("@/lib/db.server");
        const sql = db();
        const rows = await sql`
          SELECT
            c.id, c.name, c.status, c.scheduled_at, c.started_at, c.finished_at,
            c.from_email, c.from_name, c.reply_to, c.provider, c.created_at,
            CASE
              WHEN c.status IN ('draft','scheduled') AND COALESCE(c.total_recipients, 0) = 0
              THEN COALESCE((
                SELECT COUNT(DISTINCT m.contact_id)::int
                FROM contact_list_members m
                JOIN contacts ct ON ct.id = m.contact_id
                WHERE m.list_id = ANY(
                  CASE WHEN array_length(c.list_ids, 1) > 0
                       THEN c.list_ids
                       ELSE ARRAY[c.list_id]::uuid[]
                  END
                )
                  AND ct.unsubscribed = false
                  AND NOT EXISTS (SELECT 1 FROM suppressed_emails s WHERE s.email = lower(ct.email))
              ), 0)
              ELSE c.total_recipients
            END AS total_recipients
          FROM campaigns c
          ORDER BY c.created_at DESC`;
        return json({ data: rows });
      },
      POST: async ({ request }) => {
        const auth = await requireAuth(request);
        if (auth instanceof Response) return auth;
        const body = await request.json().catch(() => ({}));

        // Batch 5: Zod validation + html_body sanitization.
        const { campaignCreateSchema, zerr } = await import("@/lib/validation");
        const { sanitizeEmailHtml } = await import("@/lib/sanitize.server");
        const parsed = campaignCreateSchema.safeParse(body);
        if (!parsed.success) return json(zerr(parsed.error), 400);
        const v = parsed.data;
        const safeHtml = sanitizeEmailHtml(v.html_body);
        if (!safeHtml) return json({ error: "Email body is empty after sanitization" }, 400);

        const { db } = await import("@/lib/db.server");
        const sql = db();
        const primary = v.list_ids[0];
        const rows = await sql`
          INSERT INTO campaigns (name, template_id, list_id, list_ids, subject, html_body, text_body,
                                 from_email, from_name, reply_to, provider, status, scheduled_at)
          VALUES (${v.name}, ${v.template_id || null}, ${primary}, ${v.list_ids as any},
                  ${v.subject}, ${safeHtml}, ${v.text_body || null}, ${v.from_email}, ${v.from_name},
                  ${v.reply_to || null}, ${v.provider || null}, ${v.scheduled_at ? "scheduled" : "draft"}, ${v.scheduled_at || null})
          RETURNING *`;
        return json(rows[0]);
      },
    },
  },
});
