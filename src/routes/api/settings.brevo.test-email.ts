import { createFileRoute } from "@tanstack/react-router";
import { requireAuth, json } from "@/lib/server-auth";

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

// Sends a test email through Brevo only. This never touches AWS SES
// configuration or credentials.
export const Route = createFileRoute("/api/settings/brevo/test-email")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await requireAuth(request);
        if (auth instanceof Response) return auth;

        const body = (await request.json().catch(() => ({}))) as { to?: string };
        const to = (body.to || "").trim();
        if (!to || !isEmail(to)) return json({ ok: false, error: "Invalid 'to' address" }, 400);

        const fromEmail = process.env.BREVO_SENDER_EMAIL;
        const fromName = process.env.BREVO_SENDER_NAME || "HSENations";
        if (!fromEmail) return json({ ok: false, error: "BREVO_SENDER_EMAIL not set" }, 400);

        try {
          const { sendEmail } = await import("@/lib/brevo.server");
          const messageId = await sendEmail({
            to,
            fromEmail,
            fromName,
            subject: "HSENations Mail — Brevo test email",
            html: `<!doctype html><html><body style="font-family:system-ui,sans-serif;color:#111">
              <h2>Brevo test email</h2>
              <p>This message was sent from the HSENations Mail admin console to verify your Brevo configuration.</p>
              <p style="color:#666;font-size:12px">Triggered by ${auth.email} at ${new Date().toISOString()}.</p>
              </body></html>`,
            text: "HSENations Mail — Brevo test email. Sent from the admin console.",
          });
          return json({ ok: true, message_id: messageId, to });
        } catch (e: any) {
          return json({ ok: false, error: e?.message || "Brevo send failed" }, 502);
        }
      },
    },
  },
});
