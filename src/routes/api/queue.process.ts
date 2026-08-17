// Internal queue processor endpoint. Ported from backend/src/worker.js (single tick).
// Authentication: requires QUEUE_PROCESS_SECRET shared secret OR an authenticated admin.
import { createFileRoute } from "@tanstack/react-router";
import crypto from "node:crypto";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

const MAX_ATTEMPTS = 3;

async function getOrCreateUnsubToken(sql: any, contactId: string | null, campaignId: string) {
  if (!contactId) return crypto.randomBytes(16).toString("hex");
  const existing = await sql`
    SELECT token FROM unsubscribe_tokens
    WHERE contact_id = ${contactId} AND campaign_id IS NOT DISTINCT FROM ${campaignId}`;
  if (existing[0]) return existing[0].token;
  const token = crypto.randomBytes(24).toString("hex");
  await sql`INSERT INTO unsubscribe_tokens (token, contact_id, campaign_id)
            VALUES (${token}, ${contactId}, ${campaignId})`;
  return token;
}

export const Route = createFileRoute("/api/queue/process")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Auth: shared secret OR admin bearer
        const expected = process.env.QUEUE_PROCESS_SECRET;
        const url = new URL(request.url);
        const provided =
          url.searchParams.get("secret") ||
          request.headers.get("x-queue-secret") ||
          "";
        let authorized = !!(expected && provided && provided === expected);
        if (!authorized) {
          const { requireAuth } = await import("@/lib/server-auth");
          const auth = await requireAuth(request);
          if (auth instanceof Response) return auth;
          authorized = true;
        }
        if (!authorized) return json({ error: "Unauthorized" }, 401);

        const batchSize = Math.min(
          parseInt(url.searchParams.get("batch") || process.env.WORKER_BATCH || "20", 10),
          100,
        );
        const appUrl = (process.env.APP_URL || new URL(request.url).origin).replace(/\/$/, "");

        const { db } = await import("@/lib/db.server");
        const { sendWithProvider } = await import("@/lib/email-provider.server");
        const { personalizeHtml } = await import("@/lib/tracking.server");
        const sql = db();

        // 1. Activate scheduled campaigns
        await sql`UPDATE campaigns
                  SET status = 'queued', started_at = COALESCE(started_at, now())
                  WHERE status = 'scheduled' AND scheduled_at <= now()`;

        // 2. Claim a batch
        const batch = await sql<
          {
            id: string;
            campaign_id: string;
            contact_id: string | null;
            recipient_email: string;
            attempts: number;
          }[]
        >`
          UPDATE email_queue SET status = 'sending', attempts = attempts + 1
          WHERE id IN (
            SELECT q.id FROM email_queue q
            JOIN campaigns c ON c.id = q.campaign_id
            WHERE q.status = 'pending' AND c.status IN ('queued','sending')
            ORDER BY q.created_at ASC
            LIMIT ${batchSize}
            FOR UPDATE SKIP LOCKED
          )
          RETURNING id, campaign_id, contact_id, recipient_email, attempts`;

        let sent = 0;
        let failed = 0;
        let skipped = 0;

        for (const item of batch) {
          try {
            const campRows = await sql<any[]>`SELECT * FROM campaigns WHERE id = ${item.campaign_id}`;
            const camp = campRows[0];
            if (!camp) {
              skipped++;
              continue;
            }

            // Suppression check (lowercased lookup via helper).
            const { isSuppressed } = await import("@/lib/suppression.server");
            if (await isSuppressed(item.recipient_email)) {
              await sql`UPDATE email_queue
                        SET status = 'skipped', last_error = 'suppressed'
                        WHERE id = ${item.id}`;
              await sql`INSERT INTO campaign_events (campaign_id, queue_id, event_type, metadata)
                        VALUES (${item.campaign_id}, ${item.id}, 'skipped',
                                ${sql.json({ reason: "suppressed", email: item.recipient_email })})`;
              skipped++;
              continue;
            }
            // Unsubscribe check
            if (item.contact_id) {
              const u = await sql<{ unsubscribed: boolean }[]>`
                SELECT unsubscribed FROM contacts WHERE id = ${item.contact_id}`;
              if (u[0]?.unsubscribed) {
                await sql`UPDATE email_queue
                          SET status = 'skipped', last_error = 'unsubscribed'
                          WHERE id = ${item.id}`;
                await sql`INSERT INTO campaign_events (campaign_id, queue_id, event_type, metadata)
                          VALUES (${item.campaign_id}, ${item.id}, 'skipped',
                                  ${sql.json({ reason: "unsubscribed", email: item.recipient_email })})`;
                skipped++;
                continue;
              }
            }


            const unsubToken = await getOrCreateUnsubToken(sql, item.contact_id, camp.id);

            // Contact merge tags ({{name}}, {{email}}, {{phone}}, {{company}}...)
            const { buildMergeTags, applyMergeTags } = await import("@/lib/merge-tags");
            let contactRow: any = null;
            if (item.contact_id) {
              const cr = await sql<any[]>`
                SELECT first_name, last_name, email, phone, company, award_category
                FROM contacts WHERE id = ${item.contact_id}`;
              contactRow = cr[0] || null;
            }
            const tags = buildMergeTags(
              { ...(contactRow || {}), email: contactRow?.email || item.recipient_email },
              { campaign_name: camp.name || "" },
            );

            const html = personalizeHtml(applyMergeTags(camp.html_body || "", tags), {
              queueId: item.id,
              campaignId: camp.id,
              appUrl,
              unsubToken,
            });

            const { messageId: msgId } = await sendWithProvider(camp.provider, {
              to: item.recipient_email,
              fromEmail: camp.from_email,
              fromName: camp.from_name,
              replyTo: camp.reply_to || (await import("@/lib/email-defaults")).DEFAULT_REPLY_TO,
              subject: applyMergeTags(camp.subject || "", tags),
              html,
              text: applyMergeTags(camp.text_body || "", tags) || camp.text_body,
            });
            await sql`UPDATE email_queue
                      SET status = 'sent', sent_at = now(), ses_message_id = ${msgId}
                      WHERE id = ${item.id}`;
            await sql`INSERT INTO campaign_events (campaign_id, queue_id, event_type, metadata)
                      VALUES (${camp.id}, ${item.id}, 'send', ${sql.json({ ses_message_id: msgId })})`;
            sent++;
          } catch (e: any) {
            const err = String(e?.message || e);
            if (item.attempts >= MAX_ATTEMPTS) {
              await sql`UPDATE email_queue SET status = 'failed', last_error = ${err} WHERE id = ${item.id}`;
              await sql`INSERT INTO campaign_events (campaign_id, queue_id, event_type, metadata)
                        VALUES (${item.campaign_id}, ${item.id}, 'failed', ${sql.json({ error: err })})`;
            } else {
              await sql`UPDATE email_queue SET status = 'pending', last_error = ${err} WHERE id = ${item.id}`;
            }
            failed++;
          }
        }

        // 3. Finalize
        await sql`UPDATE campaigns c SET status = 'sent', finished_at = now()
                  WHERE c.status IN ('queued','sending')
                    AND NOT EXISTS (
                      SELECT 1 FROM email_queue q
                      WHERE q.campaign_id = c.id AND q.status IN ('pending','sending')
                    )`;
        await sql`UPDATE campaigns SET status = 'sending'
                  WHERE status = 'queued'
                    AND EXISTS (
                      SELECT 1 FROM email_queue q
                      WHERE q.campaign_id = campaigns.id AND q.status IN ('sending','sent')
                    )`;

        return json({ ok: true, claimed: batch.length, sent, failed, skipped });
      },
    },
  },
});
