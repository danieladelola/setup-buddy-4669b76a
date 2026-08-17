import { createFileRoute } from "@tanstack/react-router";
import { requireAuth, json } from "@/lib/server-auth";

// Paginated list of email_queue rows joined with campaign name. Filters:
//   status, campaign_id, q (recipient email substring), from, to (ISO dates)
export const Route = createFileRoute("/api/queue")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await requireAuth(request);
        if (auth instanceof Response) return auth;
        const url = new URL(request.url);
        const status = url.searchParams.get("status") || "";
        const campaignId = url.searchParams.get("campaign_id") || "";
        const q = (url.searchParams.get("q") || "").trim().toLowerCase();
        const from = url.searchParams.get("from") || "";
        const to = url.searchParams.get("to") || "";
        const limit = Math.min(parseInt(url.searchParams.get("limit") || "100", 10), 500);
        const offset = Math.max(parseInt(url.searchParams.get("offset") || "0", 10), 0);

        const { db } = await import("@/lib/db.server");
        const sql = db();

        const hasStatus = !!status;
        const hasCampaign = !!campaignId;
        const hasQ = !!q;
        const hasFrom = !!from;
        const hasTo = !!to;

        const rows = await sql<any[]>`
          SELECT q.id, q.campaign_id, q.recipient_email, q.status, q.attempts,
                 q.last_error, q.ses_message_id, q.sent_at, q.created_at,
                 COALESCE(q.sent_at, q.created_at) AS updated_at,
                 c.name AS campaign_name
          FROM email_queue q
          LEFT JOIN campaigns c ON c.id = q.campaign_id
          WHERE (${!hasStatus}::boolean OR q.status = ${status})
            AND (${!hasCampaign}::boolean OR q.campaign_id = ${campaignId || null}::uuid)
            AND (${!hasQ}::boolean OR lower(q.recipient_email) LIKE ${"%" + q + "%"})
            AND (${!hasFrom}::boolean OR q.created_at >= ${from || null}::timestamptz)
            AND (${!hasTo}::boolean OR q.created_at <= ${to || null}::timestamptz)
          ORDER BY q.created_at DESC
          LIMIT ${limit} OFFSET ${offset}`;

        const totalRow = await sql<{ count: string }[]>`
          SELECT count(*)::text AS count FROM email_queue q
          WHERE (${!hasStatus}::boolean OR q.status = ${status})
            AND (${!hasCampaign}::boolean OR q.campaign_id = ${campaignId || null}::uuid)
            AND (${!hasQ}::boolean OR lower(q.recipient_email) LIKE ${"%" + q + "%"})
            AND (${!hasFrom}::boolean OR q.created_at >= ${from || null}::timestamptz)
            AND (${!hasTo}::boolean OR q.created_at <= ${to || null}::timestamptz)`;

        const metricsRows = await sql<{ status: string; count: string }[]>`
          SELECT status, count(*)::text AS count FROM email_queue GROUP BY status`;
        const metrics: Record<string, number> = {
          pending: 0, sending: 0, sent: 0, failed: 0, skipped: 0, cancelled: 0,
        };
        for (const m of metricsRows) metrics[m.status] = parseInt(m.count, 10);

        const lastProcessed = await sql<{ sent_at: Date }[]>`
          SELECT sent_at FROM email_queue WHERE sent_at IS NOT NULL
          ORDER BY sent_at DESC LIMIT 1`;

        return json({
          rows,
          total: parseInt(totalRow[0]?.count || "0", 10),
          limit,
          offset,
          metrics,
          last_processed_at: lastProcessed[0]?.sent_at || null,
        });
      },
    },
  },
});
