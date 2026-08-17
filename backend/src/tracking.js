import crypto from "node:crypto";

const SECRET = process.env.TRACKING_SECRET || "dev-tracking-secret";

const b64url = (buf) =>
  Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const fromB64url = (s) => {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return Buffer.from(s, "base64");
};

export const signPayload = (obj) => {
  const data = b64url(JSON.stringify(obj));
  const sig = b64url(crypto.createHmac("sha256", SECRET).update(data).digest());
  return `${data}.${sig}`;
};

export const verifyPayload = (token) => {
  const [data, sig] = String(token || "").split(".");
  if (!data || !sig) return null;
  const expected = b64url(crypto.createHmac("sha256", SECRET).update(data).digest());
  if (sig !== expected) return null;
  try {
    return JSON.parse(fromB64url(data).toString("utf8"));
  } catch {
    return null;
  }
};

// Rewrite anchor hrefs and inject tracking pixel for a given recipient.
export const personalizeHtml = (html, { queueId, campaignId, appUrl, unsubToken }) => {
  let out = html;

  // Replace {{unsubscribe_url}} placeholder
  const unsubUrl = `${appUrl}/u/${unsubToken}`;
  out = out.replaceAll("{{unsubscribe_url}}", unsubUrl);
  out = out.replaceAll("{{unsubscribe}}", unsubUrl);

  // Rewrite links: <a href="..."> -> tracked redirect
  out = out.replace(/<a\s+([^>]*?)href=["']([^"']+)["']([^>]*)>/gi, (m, pre, href, post) => {
    if (href.startsWith("mailto:") || href.startsWith("#") || href.includes("/t/u/") || href === unsubUrl)
      return m;
    const tok = signPayload({ q: queueId, c: campaignId, u: href });
    return `<a ${pre}href="${appUrl}/t/c/${tok}"${post}>`;
  });

  // Append open pixel + unsubscribe footer if missing
  const pixel = `<img src="${appUrl}/t/o/${signPayload({ q: queueId, c: campaignId })}" width="1" height="1" alt="" style="display:block;border:0;outline:none" />`;
  const footer = `<div style="margin-top:24px;font-size:12px;color:#888;text-align:center">
    <a href="${unsubUrl}" style="color:#888">Unsubscribe</a>
  </div>`;

  if (out.includes("</body>")) {
    out = out.replace("</body>", `${footer}${pixel}</body>`);
  } else {
    out = `${out}${footer}${pixel}`;
  }
  return out;
};
