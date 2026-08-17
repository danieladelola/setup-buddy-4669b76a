import { createFileRoute } from "@tanstack/react-router";
import { requireAuth, json } from "@/lib/server-auth";

// Resets every 'failed' row back to 'pending' so the worker re-claims it.
// Also unfreezes the parent campaign if it was finalised as 'sent'.
export const Route = createFileRoute("/api/queue/retry-failed")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await requireAuth(request);
        if (auth instanceof Response) return auth;
        const body = await request.json().catch(() => ({} as any));
        const campaignId: string | null = body?.campaign_id || null;

        const { db } = await import("@/lib/db.server");
        const sql = db();

        const updated = campaignId
          ? await sql`UPDATE email_queue SET status = 'pending', last_error = NULL, attempts = 0
                      WHERE status = 'failed' AND campaign_id = ${campaignId}`
          : await sql`UPDATE email_queue SET status = 'pending', last_error = NULL, attempts = 0
                      WHERE status = 'failed'`;

        // Reopen finalised campaigns so the worker picks the rows up again.
        await sql`UPDATE campaigns SET status = 'sending', finished_at = NULL
                  WHERE status IN ('sent','failed')
                    AND EXISTS (SELECT 1 FROM email_queue q
                                WHERE q.campaign_id = campaigns.id AND q.status = 'pending')`;

        return json({ ok: true, retried: updated.count ?? 0 });
      },
    },
  },
});
