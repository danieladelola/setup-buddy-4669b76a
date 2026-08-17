import { createFileRoute } from "@tanstack/react-router";
import { requireAuth, json } from "@/lib/server-auth";

export const Route = createFileRoute("/api/campaigns/$id/report")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const auth = await requireAuth(request);
        if (auth instanceof Response) return auth;
        const { db } = await import("@/lib/db.server");
        const sql = db();
        const rows = await sql<any[]>`
          SELECT
            (SELECT total_recipients FROM campaigns WHERE id = ${params.id}) AS total,
            count(*) FILTER (WHERE status IN ('sent','opened','clicked','bounced','complained'))::int AS sent,
            count(*) FILTER (WHERE delivered_at IS NOT NULL)::int AS delivered,
            count(*) FILTER (WHERE opened_at IS NOT NULL)::int AS opened,
            count(*) FILTER (WHERE clicked_at IS NOT NULL)::int AS clicked,
            count(*) FILTER (WHERE bounced_at IS NOT NULL)::int AS bounced,
            count(*) FILTER (WHERE complained_at IS NOT NULL)::int AS complained,
            count(*) FILTER (WHERE status = 'failed')::int AS failed
          FROM email_queue WHERE campaign_id = ${params.id}`;
        const unsub = await sql<{ c: number }[]>`
          SELECT count(*)::int AS c FROM campaign_events
          WHERE campaign_id = ${params.id} AND event_type = 'unsubscribe'`;
        const r = rows[0] || {};
        const pct = (n: number) => (r.sent ? +((n / r.sent) * 100).toFixed(2) : 0);
        return json({
          ...r,
          unsubscribed: unsub[0]?.c ?? 0,
          delivery_rate: pct(r.delivered),
          open_rate: pct(r.opened),
          click_rate: pct(r.clicked),
          bounce_rate: pct(r.bounced),
          complaint_rate: pct(r.complained),
        });
      },
    },
  },
});
