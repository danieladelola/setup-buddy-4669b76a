import {
  SESClient,
  SendEmailCommand,
  GetSendQuotaCommand,
  GetIdentityVerificationAttributesCommand,
} from "@aws-sdk/client-ses";

export const ses = new SESClient({
  region: process.env.AWS_REGION,
  credentials:
    process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
      ? {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        }
      : undefined,
});

export const sendEmail = async ({ to, fromEmail, fromName, subject, html, text, configurationSet, tags = [] }) => {
  const cmd = new SendEmailCommand({
    Source: `${fromName} <${fromEmail}>`,
    Destination: { ToAddresses: [to] },
    Message: {
      Subject: { Data: subject, Charset: "UTF-8" },
      Body: {
        Html: { Data: html, Charset: "UTF-8" },
        ...(text ? { Text: { Data: text, Charset: "UTF-8" } } : {}),
      },
    },
    ConfigurationSetName: configurationSet || process.env.SES_CONFIGURATION_SET || undefined,
    Tags: tags.length ? tags : undefined,
  });
  const res = await ses.send(cmd);
  return res.MessageId;
};

const mask = (v) => {
  if (!v) return null;
  if (v.length <= 8) return "•".repeat(v.length);
  return `${v.slice(0, 4)}••••${v.slice(-4)}`;
};

export const getSesConfig = () => {
  const env = process.env;
  const required = {
    AWS_REGION: env.AWS_REGION,
    AWS_ACCESS_KEY_ID: env.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: env.AWS_SECRET_ACCESS_KEY,
    SES_CONFIGURATION_SET: env.SES_CONFIGURATION_SET,
    SES_SNS_TOPIC_ARN: env.SES_SNS_TOPIC_ARN,
    DEFAULT_FROM_EMAIL: env.DEFAULT_FROM_EMAIL,
    DEFAULT_FROM_NAME: env.DEFAULT_FROM_NAME,
    TRACKING_SECRET: env.TRACKING_SECRET,
    SNS_WEBHOOK_SECRET: env.SNS_WEBHOOK_SECRET,
    APP_URL: env.APP_URL,
  };
  const missing = Object.entries(required)
    .filter(([, v]) => !v)
    .map(([k]) => k);
  const appUrl = (env.APP_URL || "").replace(/\/$/, "");
  return {
    region: env.AWS_REGION || null,
    accessKeyIdMasked: mask(env.AWS_ACCESS_KEY_ID),
    hasSecretKey: !!env.AWS_SECRET_ACCESS_KEY,
    configurationSet: env.SES_CONFIGURATION_SET || null,
    snsTopicArn: env.SES_SNS_TOPIC_ARN || null,
    defaultFromEmail: env.DEFAULT_FROM_EMAIL || null,
    defaultFromName: env.DEFAULT_FROM_NAME || null,
    appUrl: appUrl || null,
    snsWebhookUrl: appUrl ? `${appUrl}/api/webhooks/sns` : null,
    hasTrackingSecret: !!env.TRACKING_SECRET,
    hasSnsWebhookSecret: !!env.SNS_WEBHOOK_SECRET,
    missing,
    healthy: missing.length === 0,
  };
};

export const verifyCredentials = async () => {
  const res = await ses.send(new GetSendQuotaCommand({}));
  return {
    ok: true,
    max24HourSend: res.Max24HourSend,
    sentLast24Hours: res.SentLast24Hours,
    maxSendRate: res.MaxSendRate,
  };
};

export const verifyIdentity = async (identity) => {
  const id = identity || process.env.DEFAULT_FROM_EMAIL;
  if (!id) throw new Error("No identity provided");
  const domain = id.includes("@") ? id.split("@")[1] : id;
  const res = await ses.send(
    new GetIdentityVerificationAttributesCommand({ Identities: [id, domain] }),
  );
  const attrs = res.VerificationAttributes || {};
  return {
    identity: id,
    domain,
    emailStatus: attrs[id]?.VerificationStatus || "NotFound",
    domainStatus: attrs[domain]?.VerificationStatus || "NotFound",
  };
};

export const sendTestEmail = async (to) => {
  const fromEmail = process.env.DEFAULT_FROM_EMAIL;
  const fromName = process.env.DEFAULT_FROM_NAME || "HSENations";
  if (!fromEmail) throw new Error("DEFAULT_FROM_EMAIL not configured");
  if (!to) throw new Error("Recipient required");
  const id = await sendEmail({
    to,
    fromEmail,
    fromName,
    subject: "HSENations Mail — SES test",
    html: `<p>This is a test email from <strong>HSENations Mail</strong>.</p>
           <p>If you received this, SES is configured correctly.</p>
           <p style="color:#888;font-size:12px">Sent at ${new Date().toISOString()}</p>`,
    text: "HSENations Mail SES test email.",
    tags: [{ Name: "type", Value: "ses-test" }],
  });
  return { ok: true, messageId: id };
};
