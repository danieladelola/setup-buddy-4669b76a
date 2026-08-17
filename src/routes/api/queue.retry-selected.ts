import { createFileRoute } from "@tanstack/react-router";
import { requireAuth, json } from "@/lib/server-auth";

export const Route = createFileRoute("/api/queue/retry-selected")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await requireAuth(request);
        if (auth instanceof Response) return auth;
        const body = await request.json().catch(() => ({} as any));
        const ids: string[] = Array.isArray(body?.ids) ? body.ids.filter((x: any) => typeof x === "string") : [];
        if (ids.length === 0) return json({ error: "ids required" }, 400);

        const { db } = await import("@/lib/db.server");
        const sql = db();
        const res = await sql`
          UPDATE email_queue SET status = 'pending', last_error = NULL, attempts = 0
          WHERE id = ANY(${ids}::uuid[]) AND status IN ('failed','skipped','cancelled')`;
        await sql`UPDATE campaigns SET status = 'sending', finished_at = NULL
                  WHERE status IN ('sent','failed')
                    AND EXISTS (SELECT 1 FROM email_queue q
                                WHERE q.campaign_id = campaigns.id AND q.status = 'pending')`;
        return json({ ok: true, retried: res.count ?? 0 });
      },
    },
  },
});
