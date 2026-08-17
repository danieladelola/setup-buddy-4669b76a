// HTML sanitization for the template builder + tracking-link safety.
//
// IMPORTANT: This runs inside the Cloudflare Workers runtime (TanStack Start
// edge target). `isomorphic-dompurify` pulls in jsdom which references
// `__dirname` and crashes at send time with:
//   "__dirname is not defined in ES module scope"
// We use the pure-JS `xss` library instead — Workers-compatible, no DOM, no
// Node built-ins. Email HTML is intentionally permissive: tables, inline
// styles, and most presentational tags are required. We hard-block:
//   - <script>, <iframe>, <object>, <embed>, <form>, <meta>, <link>, <base>
//   - all on* event handlers
//   - javascript:, data:, vbscript:, file: URLs on href/src
import { FilterXSS } from "xss";

const EMAIL_ALLOWED_ATTR = [
  "href", "src", "alt", "title", "name", "id", "class", "style", "target", "rel",
  "width", "height", "align", "valign", "bgcolor", "border", "cellpadding",
  "cellspacing", "colspan", "rowspan", "role", "dir", "lang",
];

const EMAIL_TAGS = [
  "a", "b", "blockquote", "br", "center", "code", "col", "colgroup",
  "div", "em", "figure", "figcaption", "font", "h1", "h2", "h3", "h4", "h5", "h6",
  "hr", "i", "img", "label", "li", "ol", "p", "pre", "small", "span", "strong",
  "sub", "sup", "table", "tbody", "td", "tfoot", "th", "thead", "tr", "u", "ul",
  "style",
];

const whiteList: Record<string, string[]> = {};
for (const tag of EMAIL_TAGS) whiteList[tag] = EMAIL_ALLOWED_ATTR;

// Restrict URL schemes on href/src to http(s) + mailto/tel + relative paths.
const SAFE_URL_RE = /^(?:(?:https?|mailto|tel):|[/?#]|$)/i;

const emailFilter = new FilterXSS({
  whiteList,
  stripIgnoreTag: true,
  // NOTE: only include tags that have a closing counterpart. Void tags like
  // <meta>, <link>, <base> have no closing tag, so the xss lib's StripTagBody
  // would leave its internal "[removed]" placeholder behind in the output
  // (visible as preheader text in Gmail). Those are handled by stripIgnoreTag.
  stripIgnoreTagBody: ["script", "iframe", "object", "embed", "form", "title"],
  allowCommentTag: false,
  css: false, // we keep inline `style` attrs as-is; xss otherwise would also lint them
  onTagAttr: (_tag, name, value) => {
    if (name === "href" || name === "src") {
      if (!SAFE_URL_RE.test(value)) return "";
    }
    if (name.startsWith("on")) return "";
    return undefined; // use default behavior
  },
});

const plainFilter = new FilterXSS({
  whiteList: {},
  stripIgnoreTag: true,
  stripIgnoreTagBody: ["script", "style"],
  allowCommentTag: false,
});

/** Sanitize an HTML fragment intended for email body or preview. */
export function sanitizeEmailHtml(html: unknown): string {
  if (typeof html !== "string" || html.length === 0) return "";
  // 1MB cap — anything larger is almost certainly an attack or accident.
  if (html.length > 1_000_000) return "";
  return emailFilter.process(html);
}

/** Sanitize a plain string by stripping every tag. Used for short fields. */
export function sanitizePlain(value: unknown, max = 500): string {
  if (typeof value !== "string") return "";
  return plainFilter.process(value).slice(0, max);
}

/**
 * Validate a redirect URL for click-tracking. Only http(s) absolute URLs pass.
 * Returns null for anything dangerous: javascript:, data:, file:, vbscript:,
 * relative paths, malformed input.
 */
export function safeRedirectUrl(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 2048) return null;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  if (!u.hostname) return null;
  return u.toString();
}
