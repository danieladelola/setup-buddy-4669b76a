import { createFileRoute } from "@tanstack/react-router";
import { requireAuth, json } from "@/lib/server-auth";

type Sender = {
  identity: string;
  type: "email" | "domain";
  status: string;
  isDefault: boolean;
};

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

export const Route = createFileRoute("/api/deliverability/senders")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await requireAuth(request);
        if (auth instanceof Response) return auth;

        const defaultFrom = process.env.DEFAULT_FROM_EMAIL || "";

        try {
          const { SESClient, ListIdentitiesCommand, GetIdentityVerificationAttributesCommand } =
            await import("@aws-sdk/client-ses");
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

          const list = await ses.send(new ListIdentitiesCommand({ MaxItems: 100 }));
          const identities = list.Identities || [];
          const items: Sender[] = [];

          if (identities.length === 0) {
            return json({ items: [] });
          }

          const attrs = await ses.send(
            new GetIdentityVerificationAttributesCommand({ Identities: identities }),
          );
          for (const id of identities) {
            const a = attrs.VerificationAttributes?.[id];
            items.push({
              identity: id,
              type: isEmail(id) ? "email" : "domain",
              status: a?.VerificationStatus || "Pending",
              isDefault: !!defaultFrom && id.toLowerCase() === defaultFrom.toLowerCase(),
            });
          }
          items.sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.identity.localeCompare(b.identity));
          return json({ items });
        } catch (e: any) {
          // Don't 500 the page — return empty list + a soft error so the UI can render.
          return json({
            items: [] as Sender[],
            error: `AWS SES query failed: ${e?.message || "unknown error"}`,
          });
        }
      },

      POST: async ({ request }) => {
        const auth = await requireAuth(request);
        if (auth instanceof Response) return auth;

        const body = (await request.json().catch(() => ({}))) as { identity?: string };
        const identity = String(body.identity || "").trim();
        if (!identity) return json({ error: "identity is required" }, 400);

        const {
          SESClient,
          VerifyEmailIdentityCommand,
          VerifyDomainIdentityCommand,
        } = await import("@aws-sdk/client-ses");
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
          if (isEmail(identity)) {
            await ses.send(new VerifyEmailIdentityCommand({ EmailAddress: identity }));
            return json({ ok: true, type: "email", identity });
          } else {
            const r = await ses.send(new VerifyDomainIdentityCommand({ Domain: identity }));
            return json({ ok: true, type: "domain", identity, verificationToken: r.VerificationToken });
          }
        } catch (e: any) {
          return json({ error: e?.message || "SES verify failed" }, 502);
        }
      },
    },
  },
});
