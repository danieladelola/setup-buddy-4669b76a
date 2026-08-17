import { createFileRoute } from "@tanstack/react-router";
import { requireAuth, json } from "@/lib/server-auth";

export const Route = createFileRoute("/api/deliverability/unsubscribes")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await requireAuth(request);
        if (auth instanceof Response) return auth;

        const url = new URL(request.url);
        const q = (url.searchParams.get("q") || "").trim().toLowerCase();
        const limit = Math.min(
          parseInt(url.searchParams.get("limit") || "200", 10) || 200,
          1000,
        );

        const { db } = await import("@/lib/db.server");
        const sql = db();

        // Union: contacts marked unsubscribed + suppressed_emails with reason 'unsubscribe'
        // for addresses that may no longer match a contact row. Last campaign is
        // resolved via the most recent unsubscribe_tokens row for the contact, falling
        // back to the most recent 'unsubscribe' campaign_event for that recipient.
        const rows = q
          ? await sql`
              WITH unsubbed_contacts AS (
                SELECT id, email, unsubscribed_at
                FROM contacts
                WHERE unsubscribed = true
                  AND email ILIKE ${"%" + q + "%"}
              ),
              from_suppression AS (
                SELECT NULL::uuid AS id, lower(s.email) AS email, s.created_at AS unsubscribed_at
                FROM suppressed_emails s
                WHERE s.reason = 'unsubscribe'
                  AND s.email ILIKE ${"%" + q + "%"}
                  AND NOT EXISTS (
                    SELECT 1 FROM contacts c WHERE lower(c.email) = lower(s.email) AND c.unsubscribed = true
                  )
              ),
              combined AS (
                SELECT id, email, unsubscribed_at FROM unsubbed_contacts
                UNION ALL
                SELECT id, email, unsubscribed_at FROM from_suppression
              )
              SELECT cb.id, cb.email, cb.unsubscribed_at,
                (
                  SELECT c.name FROM unsubscribe_tokens t
                  JOIN campaigns c ON c.id = t.campaign_id
                  WHERE t.contact_id = cb.id
                  ORDER BY t.created_at DESC LIMIT 1
                ) AS last_campaign
              FROM combined cb
              ORDER BY cb.unsubscribed_at DESC NULLS LAST
              LIMIT ${limit}`
          : await sql`
              WITH unsubbed_contacts AS (
                SELECT id, email, unsubscribed_at
                FROM contacts
                WHERE unsubscribed = true
              ),
              from_suppression AS (
                SELECT NULL::uuid AS id, lower(s.email) AS email, s.created_at AS unsubscribed_at
                FROM suppressed_emails s
                WHERE s.reason = 'unsubscribe'
                  AND NOT EXISTS (
                    SELECT 1 FROM contacts c WHERE lower(c.email) = lower(s.email) AND c.unsubscribed = true
                  )
              ),
              combined AS (
                SELECT id, email, unsubscribed_at FROM unsubbed_contacts
                UNION ALL
                SELECT id, email, unsubscribed_at FROM from_suppression
              )
              SELECT cb.id, cb.email, cb.unsubscribed_at,
                (
                  SELECT c.name FROM unsubscribe_tokens t
                  JOIN campaigns c ON c.id = t.campaign_id
                  WHERE t.contact_id = cb.id
                  ORDER BY t.created_at DESC LIMIT 1
                ) AS last_campaign
              FROM combined cb
              ORDER BY cb.unsubscribed_at DESC NULLS LAST
              LIMIT ${limit}`;

        const items = rows.map((r: any) => ({
          id: r.id || r.email,
          email: r.email,
          unsubscribed_at: r.unsubscribed_at,
          last_campaign: r.last_campaign,
        }));
        return json({ items });
      },
    },
  },
});
