// Shared suppression utilities. All paths into suppressed_emails go through here
// so reason/source/campaign/contact attribution is consistent and lowercase
// normalization is enforced.

export const VALID_REASONS = new Set([
  "bounce",
  "complaint",
  "unsubscribe",
  "manual",
  "invalid",
]);
export const VALID_SOURCES = new Set([
  "ses_sns",
  "admin",
  "unsubscribe_link",
  "import",
]);

export function normalizeEmail(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const s = String(raw).trim().toLowerCase();
  return s || null;
}

// Permissive RFC-style check; SES rejects truly malformed addresses, this just
// guards the queue from obvious junk like "n/a", "tbd", missing @, etc.
const EMAIL_RE = /^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/i;
export function isValidEmail(s: string | null | undefined): s is string {
  return !!s && EMAIL_RE.test(s);
}

export type AddSuppressionInput = {
  email: string;
  reason: string;
  source: string;
  campaignId?: string | null;
  contactId?: string | null;
  details?: unknown;
};

export async function addSuppression(input: AddSuppressionInput): Promise<{ inserted: boolean; email: string | null }> {
  const email = normalizeEmail(input.email);
  if (!isValidEmail(email)) return { inserted: false, email: null };
  const { db } = await import("@/lib/db.server");
  const sql = db();
  const reason = VALID_REASONS.has(input.reason) ? input.reason : "manual";
  const source = VALID_SOURCES.has(input.source) ? input.source : "admin";
  const res = await sql<{ email: string }[]>`
    INSERT INTO suppressed_emails (email, reason, source, campaign_id, contact_id, details)
    VALUES (
      ${email},
      ${reason},
      ${source},
      ${input.campaignId ?? null},
      ${input.contactId ?? null},
      ${sql.json((input.details ?? {}) as any)}
    )
    ON CONFLICT (email) DO UPDATE SET
      reason      = EXCLUDED.reason,
      source      = EXCLUDED.source,
      campaign_id = COALESCE(EXCLUDED.campaign_id, suppressed_emails.campaign_id),
      contact_id  = COALESCE(EXCLUDED.contact_id,  suppressed_emails.contact_id),
      details     = EXCLUDED.details
    RETURNING email`;
  return { inserted: res.length > 0, email };
}

export async function removeSuppression(emailRaw: string): Promise<boolean> {
  const email = normalizeEmail(emailRaw);
  if (!email) return false;
  const { db } = await import("@/lib/db.server");
  const sql = db();
  const res = await sql`DELETE FROM suppressed_emails WHERE email = ${email}`;
  return (res.count ?? 0) > 0;
}

export async function isSuppressed(emailRaw: string): Promise<boolean> {
  const email = normalizeEmail(emailRaw);
  if (!email) return false;
  const { db } = await import("@/lib/db.server");
  const sql = db();
  const rows = await sql<{ email: string }[]>`
    SELECT email FROM suppressed_emails WHERE email = ${email} LIMIT 1`;
  return rows.length > 0;
}
