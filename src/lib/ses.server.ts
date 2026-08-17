import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

let _ses: SESClient | null = null;
function client() {
  if (_ses) return _ses;
  _ses = new SESClient({
    region: process.env.AWS_REGION,
    credentials:
      process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
        ? {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          }
        : undefined,
  });
  return _ses;
}

export async function sendEmail(opts: {
  to: string;
  fromEmail: string;
  fromName: string;
  subject: string;
  html: string;
  text?: string | null;
  replyTo?: string | null;
}) {
  const configurationSet = process.env.SES_CONFIGURATION_SET;
  if (!configurationSet) {
    // Refuse to send without a configuration set — bounce/complaint/open
    // tracking depends on the SES → SNS event destination wired to it.
    throw new Error(
      "SES_CONFIGURATION_SET is not configured. Refusing to send: bounce/complaint tracking would be lost.",
    );
  }
  // Batch 5: defense-in-depth sanitization at the send boundary. Templates and
  // campaigns are already sanitized on write, but this catches legacy rows and
  // ad-hoc sends.
  const { sanitizeEmailHtml } = await import("@/lib/sanitize.server");
  const safeHtml = sanitizeEmailHtml(opts.html);

  const cmd = new SendEmailCommand({
    Source: `${opts.fromName} <${opts.fromEmail}>`,
    Destination: { ToAddresses: [opts.to] },
    ReplyToAddresses: opts.replyTo ? [opts.replyTo] : undefined,
    Message: {
      Subject: { Data: opts.subject, Charset: "UTF-8" },
      Body: {
        Html: { Data: safeHtml, Charset: "UTF-8" },
        ...(opts.text ? { Text: { Data: opts.text, Charset: "UTF-8" } } : {}),
      },
    },
    ConfigurationSetName: configurationSet,
  });
  const res = await client().send(cmd);
  return res.MessageId || null;
}


const mask = (v?: string | null) => {
  if (!v) return null;
  if (v.length <= 8) return "•".repeat(v.length);
  return `${v.slice(0, 4)}••••${v.slice(-4)}`;
};

export function getSesConfig() {
  const e = process.env;
  const required = {
    AWS_REGION: e.AWS_REGION,
    AWS_ACCESS_KEY_ID: e.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: e.AWS_SECRET_ACCESS_KEY,
    SES_CONFIGURATION_SET: e.SES_CONFIGURATION_SET,
    SES_SNS_TOPIC_ARN: e.SES_SNS_TOPIC_ARN,
    DEFAULT_FROM_EMAIL: e.DEFAULT_FROM_EMAIL,
    DEFAULT_FROM_NAME: e.DEFAULT_FROM_NAME,
    APP_URL: e.APP_URL,
  };
  const missing = Object.entries(required).filter(([, v]) => !v).map(([k]) => k);
  const appUrl = (e.APP_URL || "").replace(/\/$/, "");
  return {
    region: e.AWS_REGION || null,
    accessKeyIdMasked: mask(e.AWS_ACCESS_KEY_ID),
    hasSecretKey: !!e.AWS_SECRET_ACCESS_KEY,
    configurationSet: e.SES_CONFIGURATION_SET || null,
    snsTopicArn: e.SES_SNS_TOPIC_ARN || null,
    defaultFromEmail: e.DEFAULT_FROM_EMAIL || null,
    defaultFromName: e.DEFAULT_FROM_NAME || null,
    appUrl: appUrl || null,
    snsWebhookUrl: appUrl ? `${appUrl}/api/public/ses/sns` : null,
    hasTrackingSecret: !!e.TRACKING_SECRET,
    hasSnsWebhookSecret: !!e.SNS_WEBHOOK_SECRET,
    missing,
    healthy: missing.length === 0,
  };
}
