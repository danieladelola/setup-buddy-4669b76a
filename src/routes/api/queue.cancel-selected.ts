import { createFileRoute } from "@tanstack/react-router";
import { requireAuth, json } from "@/lib/server-auth";

export const Route = createFileRoute("/api/queue/cancel-selected")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await requireAuth(request);
        if (auth instanceof Response) return auth;
        const body = await request.json().catch(() => ({} as any));
        const ids: string[] = Array.isArray(body?.ids) ? body.ids.filter((x: any) => typeof x === "string") : [];
        const campaignId: string | null = body?.campaign_id || null;

        const { db } = await import("@/lib/db.server");
        const sql = db();
        // Only pending rows can be cancelled — sending/sent are immutable.
        const res = ids.length
          ? await sql`UPDATE email_queue
                      SET status = 'cancelled', last_error = 'cancelled by admin'
                      WHERE id = ANY(${ids}::uuid[]) AND status = 'pending'`
          : campaignId
            ? await sql`UPDATE email_queue
                        SET status = 'cancelled', last_error = 'cancelled by admin'
                        WHERE campaign_id = ${campaignId} AND status = 'pending'`
            : { count: 0 } as any;
        return json({ ok: true, cancelled: res.count ?? 0 });
      },
    },
  },
});
