// Byte-identical token logic copied from src/lib/tracking.server.ts.
// DO NOT change the encoding, HMAC algorithm, or payload shape — the 96
// already-delivered Brevo emails contain tokens signed with this exact scheme.
import crypto from "node:crypto";

function secret() {
  const s = process.env.TRACKING_SECRET;
  if (!s || s.length < 16) {
    throw new Error(
      "TRACKING_SECRET is required (min 16 chars). Set it in the environment before verifying tracking tokens.",
    );
  }
  return s;
}

const b64url = (buf) =>
  Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const fromB64url = (s) => {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return Buffer.from(s, "base64");
};

export const signPayload = (obj) => {
  const data = b64url(JSON.stringify(obj));
  const sig = b64url(crypto.createHmac("sha256", secret()).update(data).digest());
  return `${data}.${sig}`;
};

export const verifyPayload = (token) => {
  const [data, sig] = String(token || "").split(".");
  if (!data || !sig) return null;
  const expected = b64url(crypto.createHmac("sha256", secret()).update(data).digest());
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    return JSON.parse(fromB64url(data).toString("utf8"));
  } catch {
    return null;
  }
};

// 1x1 transparent gif — same bytes as the app.
export const PIXEL_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64",
);

/** Only absolute http(s) URLs may be redirected to (same rule as sanitize.server.ts). */
export function safeRedirectUrl(raw) {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 2048) return null;
  let u;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  if (!u.hostname) return null;
  return u.toString();
}
