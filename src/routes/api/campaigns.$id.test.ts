import { createFileRoute } from "@tanstack/react-router";
import crypto from "node:crypto";
import { requireAuth, json } from "@/lib/server-auth";

export const Route = createFileRoute("/api/campaigns/$id/test")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const auth = await requireAuth(request);
        if (auth instanceof Response) return auth;
        const { db } = await import("@/lib/db.server");
        const { sendWithProvider } = await import("@/lib/email-provider.server");
        const { personalizeHtml } = await import("@/lib/tracking.server");
        const { isSuppressed } = await import("@/lib/suppression.server");
        const body = await request.json().catch(() => ({}));
        const { testSendSchema, zerr } = await import("@/lib/validation");
        const parsed = testSendSchema.safeParse(body);
        if (!parsed.success) return json(zerr(parsed.error), 400);
        const email = (parsed.data.email || parsed.data.to)!;

        if (await isSuppressed(email)) {
          return json({ error: "Recipient is suppressed" }, 400);
        }

        const sql = db();
        const rows = await sql<{ id: string; subject: string; html_body: string; text_body: string | null; from_email: string; from_name: string; reply_to: string | null; provider: string | null }[]>`
          SELECT id, subject, html_body, text_body, from_email, from_name, reply_to, provider FROM campaigns WHERE id = ${params.id}`;
        const c = rows[0];
        if (!c) return json({ error: "Campaign not found" }, 404);

        // Same personalization path as the queue worker — merge tags, open
        // pixel, click rewrite, and unsubscribe footer all present on tests.
        const { buildMergeTags, applyMergeTags, contactName } = await import("@/lib/merge-tags");
        const contactRows = await sql<any[]>`
          SELECT first_name, last_name, email, phone, company, award_category
          FROM contacts WHERE lower(email) = lower(${email}) LIMIT 1`;
        const contact = contactRows[0] || null;
        const tags = buildMergeTags({
          first_name: contact?.first_name ?? null,
          last_name: contact?.last_name ?? null,
          name: contact ? contactName(contact, "Friend") : "Friend",
          email,
          phone: contact?.phone ?? "",
          company: contact?.company ?? "",
          award_category:
            (body as any)?.award_category ??
            contact?.award_category ??
            "AfriSAFE HSE Manager of the Year Award",
        });

        const appUrl = (process.env.APP_URL || new URL(request.url).origin).replace(/\/$/, "");
        const queueId = crypto.randomUUID();
        const unsubToken = crypto.randomBytes(24).toString("hex");
        const html = personalizeHtml(applyMergeTags(c.html_body || "", tags), {
          queueId,
          campaignId: c.id,
          appUrl,
          unsubToken,
        });

        try {
          const { messageId: id, provider } = await sendWithProvider(c.provider, {
            to: email,
            fromEmail: c.from_email,
            fromName: c.from_name,
            replyTo: c.reply_to || (await import("@/lib/email-defaults")).DEFAULT_REPLY_TO,
            subject: `[TEST] ${applyMergeTags(c.subject || "", tags)}`,
            html,
            text: applyMergeTags(c.text_body || "", tags) || c.text_body,
          });

          return json({ ok: true, message_id: id, provider });
        } catch (e: any) {
          console.error("Campaign test send failed", e);
          return json({ error: e?.message || "Send failed" }, 500);
        }
      },
    },
  },
});
