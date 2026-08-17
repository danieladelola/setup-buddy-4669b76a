import { createFileRoute } from "@tanstack/react-router";
import { requireAuth, json } from "@/lib/server-auth";

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

export const Route = createFileRoute("/api/settings/ses/test-email")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await requireAuth(request);
        if (auth instanceof Response) return auth;

        const body = (await request.json().catch(() => ({}))) as { to?: string };
        const to = (body.to || "").trim();
        if (!to || !isEmail(to)) return json({ ok: false, error: "Invalid 'to' address" }, 400);

        const fromEmail = process.env.DEFAULT_FROM_EMAIL;
        const fromName = process.env.DEFAULT_FROM_NAME || "HSENations";
        if (!fromEmail) return json({ ok: false, error: "DEFAULT_FROM_EMAIL not set" }, 400);

        try {
          const { sendEmail } = await import("@/lib/ses.server");
          const messageId = await sendEmail({
            to,
            fromEmail,
            fromName,
            subject: "HSENations Mail — SES test email",
            html: `<!doctype html><html><body style="font-family:system-ui,sans-serif;color:#111">
              <h2>SES test email</h2>
              <p>This message was sent from the HSENations Mail admin console to verify your SES configuration.</p>
              <p style="color:#666;font-size:12px">Triggered by ${auth.email} at ${new Date().toISOString()}.</p>
              </body></html>`,
            text: "HSENations Mail — SES test email. Sent from the admin console.",
          });
          return json({ ok: true, message_id: messageId, to });
        } catch (e: any) {
          return json({ ok: false, error: e?.message || "SES send failed" }, 502);
        }
      },
    },
  },
});
