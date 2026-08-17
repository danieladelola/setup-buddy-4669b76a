// Admin suppression list + manual add.
import { createFileRoute } from "@tanstack/react-router";
import { requireAuth, json } from "@/lib/server-auth";

export const Route = createFileRoute("/api/deliverability/suppression")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await requireAuth(request);
        if (auth instanceof Response) return auth;

        const url = new URL(request.url);
        const q = (url.searchParams.get("q") || "").trim().toLowerCase();
        const limit = Math.min(parseInt(url.searchParams.get("limit") || "200", 10) || 200, 1000);

        const { db } = await import("@/lib/db.server");
        const sql = db();
        const rows = q
          ? await sql`SELECT email, reason, source, campaign_id, contact_id, created_at
                      FROM suppressed_emails
                      WHERE email LIKE ${"%" + q + "%"}
                      ORDER BY created_at DESC LIMIT ${limit}`
          : await sql`SELECT email, reason, source, campaign_id, contact_id, created_at
                      FROM suppressed_emails
                      ORDER BY created_at DESC LIMIT ${limit}`;
        return json({ items: rows });
      },
      POST: async ({ request }) => {
        const auth = await requireAuth(request);
        if (auth instanceof Response) return auth;
        const body = await request.json().catch(() => ({}));
        const { suppressionAddSchema, zerr } = await import("@/lib/validation");
        const parsed = suppressionAddSchema.safeParse(body);
        if (!parsed.success) return json(zerr(parsed.error), 400);

        const { addSuppression } = await import("@/lib/suppression.server");
        const result = await addSuppression({
          email: parsed.data.email,
          reason: parsed.data.reason || "manual",
          source: "admin",
          details: { added_by: auth.email },
        });
        return json({ ok: true, email: result.email });
      },
    },
  },
});
