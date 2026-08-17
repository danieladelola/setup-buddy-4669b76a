import { createFileRoute } from "@tanstack/react-router";
import { requireAuth, json } from "@/lib/server-auth";

export const Route = createFileRoute("/api/settings/ses/test-credentials")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await requireAuth(request);
        if (auth instanceof Response) return auth;

        if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
          return json({ ok: false, error: "AWS credentials not configured" }, 400);
        }

        try {
          const { SESClient, GetSendQuotaCommand } = await import("@aws-sdk/client-ses");
          const ses = new SESClient({
            region: process.env.AWS_REGION,
            credentials: {
              accessKeyId: process.env.AWS_ACCESS_KEY_ID,
              secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            },
          });
          const r = await ses.send(new GetSendQuotaCommand({}));
          return json({
            ok: true,
            region: process.env.AWS_REGION,
            max_24_hour: r.Max24HourSend,
            max_send_rate: r.MaxSendRate,
            sent_last_24h: r.SentLast24Hours,
          });
        } catch (e: any) {
          return json({ ok: false, error: e?.message || "SES error" }, 502);
        }
      },
    },
  },
});
