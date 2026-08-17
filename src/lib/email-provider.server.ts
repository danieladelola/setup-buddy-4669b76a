// Provider abstraction layer for outbound email.
//
// AWS SES remains the default and its implementation is untouched
// (src/lib/ses.server.ts). Brevo is an independent second provider
// (src/lib/brevo.server.ts). Nothing here changes SES behavior.

export type ProviderName = "ses" | "brevo";
export const PROVIDER_NAMES: ProviderName[] = ["ses", "brevo"];
export const DEFAULT_PROVIDER: ProviderName = "ses";

export type SendArgs = {
  to: string;
  fromEmail: string;
  fromName: string;
  subject: string;
  html: string;
  text?: string | null;
  replyTo?: string | null;
};

export interface EmailProvider {
  readonly name: ProviderName;
  readonly label: string;
  send(args: SendArgs): Promise<string | null>;
}

export const SesEmailProvider: EmailProvider = {
  name: "ses",
  label: "AWS SES",
  async send(args) {
    const { sendEmail } = await import("@/lib/ses.server");
    return sendEmail(args);
  },
};

export const BrevoEmailProvider: EmailProvider = {
  name: "brevo",
  label: "Brevo",
  async send(args) {
    const { sendEmail } = await import("@/lib/brevo.server");
    return sendEmail(args);
  },
};

export function isProviderName(v: unknown): v is ProviderName {
  return typeof v === "string" && (PROVIDER_NAMES as string[]).includes(v);
}

/** Resolve a provider implementation by name; throws a clear config error. */
export function getProvider(name: unknown): EmailProvider {
  if (name === "ses") return SesEmailProvider;
  if (name === "brevo") return BrevoEmailProvider;
  throw new Error(
    `Invalid email provider "${String(name)}". Supported values: ${PROVIDER_NAMES.join(", ")}.`,
  );
}

/**
 * The workspace-wide default provider.
 * Precedence: app_settings.email_provider.provider → EMAIL_PROVIDER env → "ses".
 */
export async function getDefaultProviderName(): Promise<ProviderName> {
  try {
    const { db } = await import("@/lib/db.server");
    const sql = db();
    const rows = await sql<{ value: { provider?: string } | null }[]>`
      SELECT value FROM app_settings WHERE key = 'email_provider' LIMIT 1`;
    const fromDb = rows[0]?.value?.provider;
    if (isProviderName(fromDb)) return fromDb;
  } catch {
    // settings row/table unavailable — fall through to env
  }
  const fromEnv = process.env.EMAIL_PROVIDER;
  if (isProviderName(fromEnv)) return fromEnv;
  if (fromEnv) {
    throw new Error(
      `EMAIL_PROVIDER="${fromEnv}" is invalid. Supported values: ${PROVIDER_NAMES.join(", ")}.`,
    );
  }
  return DEFAULT_PROVIDER;
}

/**
 * Resolve the provider for a campaign: explicit per-campaign override wins,
 * otherwise the workspace default (which defaults to SES).
 */
export async function resolveProviderFor(
  campaignProvider?: string | null,
): Promise<EmailProvider> {
  if (campaignProvider) return getProvider(campaignProvider);
  return getProvider(await getDefaultProviderName());
}

/** Convenience: resolve + send in one call. */
export async function sendWithProvider(
  campaignProvider: string | null | undefined,
  args: SendArgs,
): Promise<{ messageId: string | null; provider: ProviderName }> {
  const provider = await resolveProviderFor(campaignProvider);
  const messageId = await provider.send(args);
  return { messageId, provider: provider.name };
}
