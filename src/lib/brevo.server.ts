// Brevo (ex-Sendinblue) transactional email. Server-only: the API key never
// leaves this module and is never returned to the browser.
//
// This file is completely independent from ses.server.ts — a Brevo failure or
// misconfiguration cannot affect the AWS SES sending path.

const BREVO_API = "https://api.brevo.com/v3";

const mask = (v?: string | null) => {
  if (!v) return null;
  if (v.length <= 8) return "•".repeat(v.length);
  return `${v.slice(0, 4)}••••${v.slice(-4)}`;
};

export function getBrevoConfig() {
  const e = process.env;
  const required = {
    BREVO_API_KEY: e.BREVO_API_KEY,
    BREVO_SENDER_EMAIL: e.BREVO_SENDER_EMAIL,
    BREVO_SENDER_NAME: e.BREVO_SENDER_NAME,
  };
  const missing = Object.entries(required).filter(([, v]) => !v).map(([k]) => k);
  return {
    apiKeyMasked: mask(e.BREVO_API_KEY),
    hasApiKey: !!e.BREVO_API_KEY,
    senderEmail: e.BREVO_SENDER_EMAIL || null,
    senderName: e.BREVO_SENDER_NAME || null,
    missing,
    healthy: missing.length === 0,
  };
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
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    throw new Error(
      "BREVO_API_KEY is not configured. Set BREVO_API_KEY, BREVO_SENDER_EMAIL and BREVO_SENDER_NAME to send via Brevo.",
    );
  }

  // Same defense-in-depth sanitization as the SES path.
  const { sanitizeEmailHtml } = await import("@/lib/sanitize.server");
  const safeHtml = sanitizeEmailHtml(opts.html);

  const senderEmail = opts.fromEmail || process.env.BREVO_SENDER_EMAIL || "";
  const senderName = opts.fromName || process.env.BREVO_SENDER_NAME || "";
  if (!senderEmail) throw new Error("Brevo sender email is not configured (BREVO_SENDER_EMAIL).");

  const res = await fetch(`${BREVO_API}/smtp/email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify({
      sender: { email: senderEmail, name: senderName || undefined },
      to: [{ email: opts.to }],
      subject: opts.subject,
      htmlContent: safeHtml,
      ...(opts.text ? { textContent: opts.text } : {}),
      ...(opts.replyTo ? { replyTo: { email: opts.replyTo } } : {}),
    }),
  });

  const bodyText = await res.text();
  if (!res.ok) {
    // Surface the provider's own error verbatim — never a generic 500.
    throw new Error(`Brevo send failed [${res.status}]: ${bodyText}`);
  }
  try {
    const parsed = JSON.parse(bodyText) as { messageId?: string };
    return parsed.messageId || null;
  } catch {
    return null;
  }
}

/** Lightweight credential check (does not send anything). */
export async function verifyCredentials() {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) throw new Error("BREVO_API_KEY is not configured.");
  const res = await fetch(`${BREVO_API}/account`, {
    headers: { Accept: "application/json", "api-key": apiKey },
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Brevo credential check failed [${res.status}]: ${body}`);
  const acc = JSON.parse(body) as { email?: string; companyName?: string };
  return { ok: true as const, email: acc.email || null, company: acc.companyName || null };
}
