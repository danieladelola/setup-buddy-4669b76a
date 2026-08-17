import { createFileRoute } from "@tanstack/react-router";
import { requireAuth, json } from "@/lib/server-auth";

const DAY = 24 * 60 * 60 * 1000;

const csvEscape = (v: unknown) => {
  if (v === null || v === undefined) return "";
  const s = v instanceof Date ? v.toISOString() : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
};

const toCsv = (header: string[], rows: any[][]) =>
  [header.join(","), ...rows.map((r) => r.map(csvEscape).join(","))].join("\n") + "\n";

export const Route = createFileRoute("/api/analytics/export")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await requireAuth(request);
        if (auth instanceof Response) return auth;

        const url = new URL(request.url);
        const type = url.searchParams.get("type") || "campaigns";
        const to = url.searchParams.get("to") || new Date().toISOString();
        const from =
          url.searchParams.get("from") || new Date(Date.now() - 90 * DAY).toISOString();

        const { db } = await import("@/lib/db.server");
        const sql = db();

        let csv = "";
        if (type === "bounces") {
          const rows = await sql`
            SELECT e.id, c.name AS campaign_name,
              COALESCE(q.recipient_email, e.metadata#>>'{bouncedRecipients,0,emailAddress}') AS recipient,
              e.metadata->>'bounceType' AS bounce_type,
              e.metadata->>'bounceSubType' AS bounce_subtype,
              e.occurred_at
            FROM campaign_events e
            LEFT JOIN email_queue q ON q.id = e.queue_id
            LEFT JOIN campaigns c ON c.id = e.campaign_id
            WHERE e.event_type='bounce'
              AND e.occurred_at >= ${from} AND e.occurred_at <= ${to}
            ORDER BY e.occurred_at DESC`;
          csv = toCsv(
            ["id", "campaign", "recipient", "bounce_type", "bounce_subtype", "occurred_at"],
            rows.map((r: any) => [
              r.id,
              r.campaign_name,
              r.recipient,
              r.bounce_type,
              r.bounce_subtype,
              r.occurred_at,
            ]),
          );
        } else if (type === "complaints") {
          const rows = await sql`
            SELECT e.id, c.name AS campaign_name,
              COALESCE(q.recipient_email, e.metadata#>>'{complainedRecipients,0,emailAddress}') AS recipient,
              e.metadata->>'complaintFeedbackType' AS feedback_type,
              e.occurred_at
            FROM campaign_events e
            LEFT JOIN email_queue q ON q.id = e.queue_id
            LEFT JOIN campaigns c ON c.id = e.campaign_id
            WHERE e.event_type='complaint'
              AND e.occurred_at >= ${from} AND e.occurred_at <= ${to}
            ORDER BY e.occurred_at DESC`;
          csv = toCsv(
            ["id", "campaign", "recipient", "feedback_type", "occurred_at"],
            rows.map((r: any) => [
              r.id,
              r.campaign_name,
              r.recipient,
              r.feedback_type,
              r.occurred_at,
            ]),
          );
        } else {
          // campaigns (default)
          const rows = await sql`
            SELECT c.id, c.name, c.status, c.from_email, c.total_recipients, c.created_at,
              count(q.*) FILTER (WHERE q.status IN ('sent','delivered','opened','clicked','bounced','complained'))::int AS sent,
              count(q.*) FILTER (WHERE q.delivered_at IS NOT NULL)::int AS delivered,
              count(q.*) FILTER (WHERE q.opened_at IS NOT NULL)::int AS opened,
              count(q.*) FILTER (WHERE q.clicked_at IS NOT NULL)::int AS clicked,
              count(q.*) FILTER (WHERE q.bounced_at IS NOT NULL)::int AS bounced,
              count(q.*) FILTER (WHERE q.complained_at IS NOT NULL)::int AS complained
            FROM campaigns c
            LEFT JOIN email_queue q ON q.campaign_id = c.id
            WHERE c.created_at >= ${from} AND c.created_at <= ${to}
            GROUP BY c.id ORDER BY c.created_at DESC`;
          csv = toCsv(
            [
              "id",
              "name",
              "status",
              "from_email",
              "total_recipients",
              "created_at",
              "sent",
              "delivered",
              "opened",
              "clicked",
              "bounced",
              "complained",
            ],
            rows.map((r: any) => [
              r.id,
              r.name,
              r.status,
              r.from_email,
              r.total_recipients,
              r.created_at,
              r.sent,
              r.delivered,
              r.opened,
              r.clicked,
              r.bounced,
              r.complained,
            ]),
          );
        }

        return new Response(csv, {
          status: 200,
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="${type}-${new Date()
              .toISOString()
              .slice(0, 10)}.csv"`,
          },
        });
      },
    },
  },
});
