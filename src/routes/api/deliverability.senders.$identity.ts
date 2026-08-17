import { createFileRoute } from "@tanstack/react-router";
import { requireAuth, json } from "@/lib/server-auth";

export const Route = createFileRoute("/api/deliverability/senders/$identity")({
  server: {
    handlers: {
      DELETE: async ({ request, params }) => {
        const auth = await requireAuth(request);
        if (auth instanceof Response) return auth;

        const identity = decodeURIComponent(params.identity);
        if (!identity) return json({ error: "identity is required" }, 400);

        const { SESClient, DeleteIdentityCommand } = await import("@aws-sdk/client-ses");
        const ses = new SESClient({
          region: process.env.AWS_REGION,
          credentials:
            process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
              ? {
                  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
                }
              : undefined,
        });
        try {
          await ses.send(new DeleteIdentityCommand({ Identity: identity }));
          return json({ ok: true });
        } catch (e: any) {
          return json({ error: e?.message || "SES delete failed" }, 502);
        }
      },
    },
  },
});
