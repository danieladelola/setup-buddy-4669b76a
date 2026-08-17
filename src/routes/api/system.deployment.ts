import { createFileRoute } from "@tanstack/react-router";
import { requireAuth, json } from "@/lib/server-auth";

// Readiness check. Reports whether each required env var is present (NEVER
// the value). Also returns convenience strings for scheduler/webhook setup.
const REQUIRED = [
  "DATABASE_URL",
  "JWT_SECRET",
  "APP_URL",
  "AWS_REGION",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "SES_CONFIGURATION_SET",
  "SES_SNS_TOPIC_ARN",
  "DEFAULT_FROM_EMAIL",
  "DEFAULT_FROM_NAME",
  "TRACKING_SECRET",
  "SNS_WEBHOOK_SECRET",
  "QUEUE_PROCESS_SECRET",
] as const;

export const Route = createFileRoute("/api/system/deployment")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await requireAuth(request);
        if (auth instanceof Response) return auth;
        const env: { name: string; present: boolean }[] = REQUIRED.map((name) => ({
          name,
          present: !!process.env[name],
        }));
        const missing = env.filter((e) => !e.present).map((e) => e.name);
        const appUrl = (process.env.APP_URL || "").replace(/\/$/, "");
        return json({
          env,
          missing,
          ready: missing.length === 0,
          app_url: appUrl,
          scheduler_command: appUrl
            ? `curl -fsS -X POST "${appUrl}/api/queue/process?batch=50" -H "x-queue-secret: $QUEUE_PROCESS_SECRET" >/dev/null`
            : null,
          sns_webhook_url: appUrl ? `${appUrl}/api/public/ses/sns?secret=$SNS_WEBHOOK_SECRET` : null,
        });
      },
    },
  },
});
