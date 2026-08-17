import { createFileRoute } from "@tanstack/react-router";
import { requireAuth, json } from "@/lib/server-auth";

export const Route = createFileRoute("/api/lists")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await requireAuth(request);
        if (auth instanceof Response) return auth;
        const { db } = await import("@/lib/db.server");
        const sql = db();
        const url = new URL(request.url);
        const q = (url.searchParams.get("q") || "").trim().toLowerCase();
        const rows = q
          ? await sql`
              SELECT l.id, l.name, l.description, l.created_at,
                (SELECT count(*)::int FROM contact_list_members m WHERE m.list_id = l.id) AS member_count
              FROM contact_lists l
              WHERE lower(l.name) LIKE ${"%" + q + "%"} OR lower(coalesce(l.description,'')) LIKE ${"%" + q + "%"}
              ORDER BY l.created_at DESC`
          : await sql`
              SELECT l.id, l.name, l.description, l.created_at,
                (SELECT count(*)::int FROM contact_list_members m WHERE m.list_id = l.id) AS member_count
              FROM contact_lists l ORDER BY l.created_at DESC`;
        return json({ data: rows });
      },
      POST: async ({ request }) => {
        const auth = await requireAuth(request);
        if (auth instanceof Response) return auth;
        const body = await request.json().catch(() => ({}));
        const { listCreateSchema, zerr } = await import("@/lib/validation");
        const parsed = listCreateSchema.safeParse(body);
        if (!parsed.success) return json(zerr(parsed.error), 400);
        const v = parsed.data;
        const { db } = await import("@/lib/db.server");
        const sql = db();
        try {
          const rows = await sql`
            INSERT INTO contact_lists (name, description) VALUES (${v.name}, ${v.description ?? null})
            RETURNING id, name, description, created_at`;
          return json({ ...rows[0], member_count: 0 });
        } catch (e: any) {
          if (e?.code === "23505") return json({ error: "A list with that name already exists" }, 409);
          console.error("list create failed", e);
          return json({ error: "Failed to create list" }, 500);
        }
      },
    },
  },
});
