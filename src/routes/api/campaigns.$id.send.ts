import { createFileRoute } from "@tanstack/react-router";
import { requireAuth, json } from "@/lib/server-auth";

// Unified send path: ALL campaigns (small or large) go through email_queue.
// Actual delivery is handled by /api/queue/process (run by the Coolify
// scheduler every ~60s). This keeps tracking, suppression, retries, and
// unsubscribe-token issuance consistent for every recipient.
export const Route = createFileRoute("/api/campaigns/$id/send")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const auth = await requireAuth(request);
        if (auth instanceof Response) return auth;
        const { db } = await import("@/lib/db.server");
        const { computeAudience } = await import("@/lib/audience.server");
        const sql = db();

        const rows = await sql<any[]>`SELECT * FROM campaigns WHERE id = ${params.id}`;
        const c = rows[0];
        if (!c) return json({ error: "Not found" }, 404);
        if (!["draft", "scheduled"].includes(c.status)) {
          return json({ error: `Cannot send a campaign in status ${c.status}` }, 400);
        }

        // Multi-list send: union members across all selected lists. Fall back
        // to the legacy single list_id column for rows created before the
        // list_ids column existed.
        const lists: string[] = Array.isArray(c.list_ids) && c.list_ids.length > 0
          ? c.list_ids.filter(Boolean)
          : [c.list_id].filter(Boolean);
        const { counts, recipients } = await computeAudience({ listIds: lists });

        if (recipients.length === 0) {
          return json({ error: "No deliverable recipients", counts }, 400);
        }

        // Bulk insert — let the queue worker handle send/personalize/track.
        for (const r of recipients) {
          await sql`INSERT INTO email_queue (campaign_id, contact_id, recipient_email)
                    VALUES (${c.id}, ${r.contact_id}, ${r.email})`;
        }
        await sql`UPDATE campaigns
                  SET status = 'queued',
                      total_recipients = ${recipients.length},
                      started_at = now()
                  WHERE id = ${c.id}`;

        return json({
          ok: true,
          queued: recipients.length,
          counts,
          note: "Campaign queued. Delivery handled by /api/queue/process scheduler.",
        });
      },
    },
  },
});
