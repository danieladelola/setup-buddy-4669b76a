import { createFileRoute } from "@tanstack/react-router";
import crypto from "node:crypto";
import { requireAuth, json } from "@/lib/server-auth";

export const Route = createFileRoute("/api/templates/$id/test-send")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const auth = await requireAuth(request);
        if (auth instanceof Response) return auth;
        const body = await request.json().catch(() => ({}));
        const { testSendSchema, zerr } = await import("@/lib/validation");
        const parsed = testSendSchema.safeParse(body);
        if (!parsed.success) return json(zerr(parsed.error), 400);
        const to = (parsed.data.to || parsed.data.email)!;


        const { db } = await import("@/lib/db.server");
        const sql = db();
        const rows = await sql`SELECT * FROM email_templates WHERE id = ${params.id}`;
        const tpl = rows[0];
        if (!tpl) return json({ error: "Template not found" }, 404);

        // Provider-aware test send. SES stays the default; an explicit
        // ?provider / body.provider of "brevo" routes through Brevo only.
        const { resolveProviderFor } = await import("@/lib/email-provider.server");
        const requested = (body as any)?.provider ?? new URL(request.url).searchParams.get("provider");
        const provider = await resolveProviderFor(requested || null);

        const fromEmail =
          provider.name === "brevo"
            ? process.env.BREVO_SENDER_EMAIL || ""
            : process.env.DEFAULT_FROM_EMAIL || "";
        const fromName =
          tpl.from_name ||
          (provider.name === "brevo"
            ? process.env.BREVO_SENDER_NAME
            : process.env.DEFAULT_FROM_NAME) ||
          "HSENations";
        if (!fromEmail)
          return json(
            {
              error:
                provider.name === "brevo"
                  ? "BREVO_SENDER_EMAIL is not configured"
                  : "DEFAULT_FROM_EMAIL is not configured",
            },
            500,
          );


        // Sample merge tag substitution so test renders look real.
        const { buildMergeTags, applyMergeTags } = await import("@/lib/merge-tags");
        // Prefer the real contact record so merge tags render exactly as a
        // live send would. Fall back to a sample contact only if unknown.
        const previewEmail = (body as any)?.preview_email || to;
        const contactRows = await sql<any[]>`
          SELECT first_name, last_name, email, phone, company, award_category
          FROM contacts WHERE lower(email) = lower(${previewEmail}) LIMIT 1`;
        const contact = contactRows[0] || null;
        const { contactName } = await import("@/lib/merge-tags");
        const tags = buildMergeTags(
          {
            name: (body as any)?.name ?? (contact ? contactName(contact, "Friend") : "Friend"),
            email: to,
            phone: contact?.phone ?? "+234 000 000 0000",
            company: contact?.company ?? "Acme Co.",
            award_category:
              (body as any)?.award_category ??
              contact?.award_category ??
              "AfriSAFE HSE Manager of the Year Award",
          },

          { campaign_name: tpl.name },
        );
        const apply = (s: string) => applyMergeTags(s, tags);

        // Run through the same personalization path as real sends so test
        // renders include the open pixel, click rewrites, and unsubscribe footer.
        const { personalizeHtml } = await import("@/lib/tracking.server");
        const appUrl = (process.env.APP_URL || new URL(request.url).origin).replace(/\/$/, "");
        const html = personalizeHtml(apply(tpl.html_body || ""), {
          queueId: crypto.randomUUID(),
          campaignId: tpl.id,
          appUrl,
          unsubToken: crypto.randomBytes(24).toString("hex"),
        });

        try {
          const messageId = await provider.send({
            to,
            fromEmail,
            fromName,
            replyTo: (await import("@/lib/email-defaults")).DEFAULT_REPLY_TO,
            subject: `[TEST] ${apply(tpl.subject || tpl.name)}`,
            html,
            text: tpl.text_body ? apply(tpl.text_body) : null,
          });
          return json({ ok: true, messageId, provider: provider.name });
        } catch (e: any) {
          return json({ error: e?.message || `${provider.label} send failed` }, 500);
        }
      },
    },
  },
});
