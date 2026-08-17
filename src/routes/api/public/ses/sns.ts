import { createFileRoute } from "@tanstack/react-router";

// Webhook endpoint for SES → SNS notifications. Signature is verified
// against the SNS SigningCertURL on every request. The shared
// SNS_WEBHOOK_SECRET is an optional belt-and-suspenders gate, not the
// primary trust mechanism.
export const Route = createFileRoute("/api/public/ses/sns")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Per-IP rate limit. SNS signature verification still runs after this.
        const { gatePublic } = await import("@/lib/public-gate.server");
        const blocked = gatePublic(request, "sns.webhook");
        if (blocked) return blocked;

        // Optional shared-secret gate. AWS SNS does NOT attach custom headers
        // or query params to notifications, so this can only ever match when
        // the subscription endpoint URL itself carries `?secret=...`. We
        // therefore treat it as a best-effort *additional* gate: a non-empty
        // mismatch is rejected, but a missing secret falls through to the
        // mandatory SNS signature verification below (the real trust
        // boundary). Without this fallback, every SNS notification 401s
        // because SNS has no way to send the secret.
        const expected = process.env.SNS_WEBHOOK_SECRET;
        if (expected) {
          const url = new URL(request.url);
          const provided = url.searchParams.get("secret") || request.headers.get("x-sns-secret");
          if (provided && provided !== expected) {
            return new Response("invalid secret", { status: 401 });
          }
        }

        const raw = await request.text();
        let body: any;
        try {
          body = raw ? JSON.parse(raw) : null;
        } catch {
          return new Response("invalid json", { status: 400 });
        }
        if (!body || typeof body !== "object") {
          return new Response("invalid body", { status: 400 });
        }

        // Mandatory SNS signature verification.
        const { verifySnsMessage } = await import("@/lib/sns-verify.server");
        const verify = await verifySnsMessage(body);
        if (!verify.ok) {
          console.warn("sns signature rejected", verify.reason);
          return new Response("invalid signature", { status: 403 });
        }

        // Topic ARN must match the configured topic (after sig verification).
        if (
          process.env.SES_SNS_TOPIC_ARN &&
          body?.TopicArn &&
          body.TopicArn !== process.env.SES_SNS_TOPIC_ARN
        ) {
          console.warn("sns topic mismatch", body.TopicArn);
          return new Response("topic mismatch", { status: 403 });
        }

        try {
          const { handleSnsEnvelope } = await import("@/lib/sns.server");
          const result = await handleSnsEnvelope(body, { verified: true });
          return new Response(result, { status: 200 });
        } catch (e) {
          console.error("sns handler err", e);
          return new Response("error", { status: 500 });
        }
      },
    },
  },
});
