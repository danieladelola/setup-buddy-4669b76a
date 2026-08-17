import { createFileRoute } from "@tanstack/react-router";
import { requireAuth, json } from "@/lib/server-auth";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const Route = createFileRoute("/api/contacts")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await requireAuth(request);
        if (auth instanceof Response) return auth;
        const { db } = await import("@/lib/db.server");
        const sql = db();
        const url = new URL(request.url);
        const q = (url.searchParams.get("q") || "").trim().toLowerCase();
        const status = (url.searchParams.get("status") || "").trim();
        const listId = (url.searchParams.get("list_id") || "").trim();
        // TODO(perf): OFFSET pagination is fine for <50k contacts. Above that,
        // switch to cursor pagination keyed on (created_at, id) DESC to avoid
        // the linear OFFSET cost. The contacts_created_at_idx (Batch 4) makes
        // the cursor variant a single index range scan.
        const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get("limit") || "25", 10)));
        const offset = Math.max(0, parseInt(url.searchParams.get("offset") || "0", 10));

        const like = "%" + q + "%";
        const hasQ = q.length > 0;
        const hasStatus = status.length > 0;
        const hasList = listId.length > 0;

        // Build WHERE dynamically via composable sql fragments.
        const where = sql`
          WHERE 1=1
          ${hasQ ? sql`AND (
            lower(c.email) LIKE ${like}
            OR lower(coalesce(c.first_name,'')) LIKE ${like}
            OR lower(coalesce(c.last_name,'')) LIKE ${like}
            OR lower(coalesce(c.phone,'')) LIKE ${like}
            OR lower(coalesce(c.company,'')) LIKE ${like}
            OR lower(coalesce(c.job_title,'')) LIKE ${like}
            OR lower(coalesce(c.award_category,'')) LIKE ${like}
            OR lower(c.status) LIKE ${like}
          )` : sql``}
          ${hasStatus ? sql`AND c.status = ${status}` : sql``}
          ${hasList ? sql`AND EXISTS (
            SELECT 1 FROM contact_list_members m WHERE m.contact_id = c.id AND m.list_id = ${listId}
          )` : sql``}
        `;

        const [{ count }] = await sql`SELECT count(*)::int AS count FROM contacts c ${where}`;
        const rows = await sql`
          SELECT c.id, c.email, c.first_name, c.last_name, c.phone, c.company, c.job_title,
                 c.award_category, c.status, c.source, c.notes, c.unsubscribed, c.created_at, c.updated_at,
                 COALESCE((
                   SELECT json_agg(json_build_object('id', l.id, 'name', l.name) ORDER BY l.name)
                   FROM contact_list_members m JOIN contact_lists l ON l.id = m.list_id
                   WHERE m.contact_id = c.id
                 ), '[]'::json) AS lists
          FROM contacts c ${where}
          ORDER BY c.created_at DESC
          LIMIT ${limit} OFFSET ${offset}`;

        return json({ data: rows, total: count, limit, offset });
      },

      POST: async ({ request }) => {
        const auth = await requireAuth(request);
        if (auth instanceof Response) return auth;
        const body = await request.json().catch(() => ({}));

        // Batch 5: Zod validation.
        const { contactCreateSchema, zerr } = await import("@/lib/validation");
        const parsed = contactCreateSchema.safeParse(body);
        if (!parsed.success) return json(zerr(parsed.error), 400);
        const v = parsed.data;

        const fields = {
          email: v.email,
          first_name: v.first_name ?? null,
          last_name: v.last_name ?? null,
          phone: v.phone ?? null,
          company: v.company ?? null,
          job_title: v.job_title ?? null,
          award_category: v.award_category ?? null,
          status: v.status || "subscribed",
          source: v.source || "manual",
          notes: v.notes ?? null,
        };

        const { db } = await import("@/lib/db.server");
        const sql = db();
        try {
          const rows = await sql`
            INSERT INTO contacts ${sql(fields)}
            RETURNING id, email, first_name, last_name, phone, company, job_title, award_category, status, source, notes, unsubscribed, created_at, updated_at`;
          const c = rows[0];

          const listIds: string[] = v.list_ids || [];
          for (const lid of listIds) {
            await sql`INSERT INTO contact_list_members (list_id, contact_id) VALUES (${lid}, ${c.id}) ON CONFLICT DO NOTHING`;
          }
          return json({ ...c, lists: [] });
        } catch (e: any) {
          if (e?.code === "23505") return json({ error: "A contact with that email already exists" }, 409);
          console.error("contact create failed", e);
          return json({ error: "Failed to create contact" }, 500);
        }
      },
    },
  },
});
