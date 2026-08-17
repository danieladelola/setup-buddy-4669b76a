import crypto from "node:crypto";

function secret(): string {
  const s = process.env.TRACKING_SECRET;
  if (!s || s.length < 16) {
    throw new Error(
      "TRACKING_SECRET is required (min 16 chars). Set it in the environment before sending or verifying tracking tokens.",
    );
  }
  return s;
}

const b64url = (buf: Buffer | string) =>
  Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const fromB64url = (s: string) => {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return Buffer.from(s, "base64");
};

export const signPayload = (obj: unknown) => {
  const data = b64url(JSON.stringify(obj));
  const sig = b64url(crypto.createHmac("sha256", secret()).update(data).digest());
  return `${data}.${sig}`;
};

export const verifyPayload = <T = any>(token: string | undefined | null): T | null => {
  const [data, sig] = String(token || "").split(".");
  if (!data || !sig) return null;
  const expected = b64url(crypto.createHmac("sha256", secret()).update(data).digest());
  // timing-safe compare
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    return JSON.parse(fromB64url(data).toString("utf8")) as T;
  } catch {
    return null;
  }
};

// 1x1 transparent gif
export const PIXEL_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64",
);

export const personalizeHtml = (
  html: string,
  opts: { queueId: string; campaignId: string; appUrl: string; unsubToken: string },
) => {
  const { queueId, campaignId, appUrl, unsubToken } = opts;
  let out = html;
  const unsubUrl = `${appUrl}/api/unsubscribe/${unsubToken}`;
  out = out.replaceAll("{{unsubscribe_url}}", unsubUrl);
  out = out.replaceAll("{{unsubscribe}}", unsubUrl);

  out = out.replace(/<a\s+([^>]*?)href=["']([^"']+)["']([^>]*)>/gi, (m, pre, href, post) => {
    if (
      href.startsWith("mailto:") ||
      href.startsWith("#") ||
      href.includes("/api/unsubscribe/") ||
      href.includes("/u/") ||
      href === unsubUrl
    ) {
      return m;
    }
    const tok = signPayload({ q: queueId, c: campaignId, u: href });
    return `<a ${pre}href="${appUrl}/api/track/click/${tok}"${post}>`;
  });

  const pixel = `<img src="${appUrl}/api/track/open/${signPayload({ q: queueId, c: campaignId })}" width="1" height="1" alt="" style="display:block;border:0;outline:none" />`;
  const footer = `<div style="margin-top:24px;font-size:12px;color:#888;text-align:center"><a href="${unsubUrl}" style="color:#888">Unsubscribe</a></div>`;

  // If the template already contains its own unsubscribe link, don't append the
  // generic footer — just add the tracking pixel.
  const hasOwnUnsub = out.includes(unsubUrl) || /href=["'][^"']*\/(api\/unsubscribe|u)\//i.test(out);
  const tail = hasOwnUnsub ? pixel : `${footer}${pixel}`;

  if (out.includes("</body>")) {
    out = out.replace("</body>", `${tail}</body>`);
  } else {
    out = `${out}${tail}`;
  }
  return out;
};
