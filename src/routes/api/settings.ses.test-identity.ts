import { createFileRoute } from "@tanstack/react-router";
import { requireAuth, json } from "@/lib/server-auth";

export const Route = createFileRoute("/api/settings/ses/test-identity")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await requireAuth(request);
        if (auth instanceof Response) return auth;

        const body = (await request.json().catch(() => ({}))) as { identity?: string };
        const identity = (body.identity || process.env.DEFAULT_FROM_EMAIL || "").trim();
        if (!identity) {
          return json({ ok: false, error: "No identity or DEFAULT_FROM_EMAIL provided" }, 400);
        }

        try {
          const { SESClient, GetIdentityVerificationAttributesCommand } = await import(
            "@aws-sdk/client-ses"
          );
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
          const lookup = identity.includes("@") ? identity : identity;
          const r = await ses.send(
            new GetIdentityVerificationAttributesCommand({ Identities: [lookup] }),
          );
          const attrs = r.VerificationAttributes?.[lookup];
          return json({
            ok: true,
            identity: lookup,
            status: attrs?.VerificationStatus || "NotFound",
          });
        } catch (e: any) {
          return json({ ok: false, error: e?.message || "SES error" }, 502);
        }
      },
    },
  },
});
