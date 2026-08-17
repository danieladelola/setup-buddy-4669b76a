// Email-safe HTML renderer. Generates a table-based document with inline CSS,
// a small <style> block for media queries (mobile responsiveness), and
// inserts merge tags as raw {{ ... }} markers for downstream substitution.

import type {
  Block, BuilderDoc, EmailSettings, ImageProps, ButtonProps, ColumnsProps,
  HeroProps, CardProps, EventProps, SocialProps, FooterProps, UnsubscribeProps,
} from "./types";

const escapeHtml = (s: string) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const pad = (b: any) =>
  `padding:${b.paddingTop ?? 8}px ${b.paddingX ?? 24}px ${b.paddingBottom ?? 8}px;`;

const visibilityClass = (b: any) =>
  [b.hiddenOnMobile ? "hide-mobile" : "", b.hiddenOnDesktop ? "hide-desktop" : ""]
    .filter(Boolean).join(" ");

function renderBlock(block: Block, settings: EmailSettings): string {
  const vCls = visibilityClass(block.props);
  const tdAttrs = `style="${pad(block.props)}${block.props.bgColor ? `background-color:${block.props.bgColor};` : ""}" class="${vCls}"`;
  const wrap = (inner: string) =>
    `<tr><td ${tdAttrs}>${inner}</td></tr>`;

  switch (block.type) {
    case "heading": {
      const p = block.props;
      const Tag = `h${p.level}`;
      return wrap(
        `<${Tag} style="margin:0;font-family:${settings.fontFamily};color:${p.color};font-size:${p.fontSize}px;font-weight:${p.fontWeight};line-height:1.25;text-align:${p.align};">${escapeHtml(p.text)}</${Tag}>`
      );
    }
    case "paragraph":
    case "text": {
      const p = block.props;
      return wrap(
        `<p style="margin:0;font-family:${settings.fontFamily};color:${p.color};font-size:${p.fontSize}px;line-height:${p.lineHeight};text-align:${p.align};white-space:pre-wrap;">${escapeHtml(p.text)}</p>`
      );
    }
    case "image":
    case "logo": {
      const p = block.props as ImageProps;
      const imgStyle = `display:block;border:0;outline:none;text-decoration:none;max-width:100%;height:auto;border-radius:${p.borderRadius}px;${p.width ? `width:${p.width}px;` : "width:100%;"}`;
      const img = `<img src="${escapeHtml(p.src)}" alt="${escapeHtml(p.alt)}" style="${imgStyle}" />`;
      const anchored = p.href ? `<a href="${escapeHtml(p.href)}" target="_blank" rel="noopener" style="text-decoration:none;">${img}</a>` : img;
      return wrap(`<div style="text-align:${p.align};">${anchored}</div>`);
    }
    case "button": {
      const p = block.props as ButtonProps;
      const inner = `<a href="${escapeHtml(p.href)}" target="_blank" rel="noopener" style="background-color:${p.bgColor};color:${p.color};display:inline-block;font-family:${settings.fontFamily};font-size:${p.fontSize}px;font-weight:${p.fontWeight};text-decoration:none;padding:${p.paddingY}px ${p.paddingX2}px;border-radius:${p.borderRadius}px;mso-padding-alt:0;${p.fullWidth ? "width:100%;text-align:center;" : ""}">${escapeHtml(p.text)}</a>`;
      return wrap(`<div style="text-align:${p.align};">${inner}</div>`);
    }
    case "divider": {
      const p = block.props;
      return wrap(`<div style="border-top:${p.thickness}px solid ${p.color};font-size:0;line-height:0;">&nbsp;</div>`);
    }
    case "spacer": {
      const p = block.props;
      return `<tr><td style="font-size:0;line-height:0;height:${p.height}px;" class="${vCls}">&nbsp;</td></tr>`;
    }
    case "columns": {
      const p = block.props as ColumnsProps;
      const widths = p.ratio === "1:1" ? [50, 50]
        : p.ratio === "1:2" ? [33.33, 66.67]
        : p.ratio === "2:1" ? [66.67, 33.33]
        : [33.33, 33.33, 33.34];
      const cols = (p.columns || []).slice(0, widths.length);
      while (cols.length < widths.length) cols.push([]);
      const tds = cols.map((colBlocks, i) => {
        const inner = colBlocks.map((b) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${renderBlock(b, settings)}</table>`).join("");
        return `<td class="col${p.stackOnMobile ? " col-stack" : ""}" width="${widths[i]}%" valign="top" style="padding:0 ${p.gap / 2}px;">${inner}</td>`;
      }).join("");
      return wrap(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${tds}</tr></table>`);
    }
    case "hero": {
      const p = block.props as HeroProps;
      const bgImage = `background:${p.overlayColor} url('${escapeHtml(p.imageSrc)}') center/cover no-repeat;`;
      const cta = p.ctaText
        ? `<div style="margin-top:16px;"><a href="${escapeHtml(p.ctaHref)}" target="_blank" rel="noopener" style="background:#ffffff;color:#111827;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;font-family:${settings.fontFamily};">${escapeHtml(p.ctaText)}</a></div>`
        : "";
      const inner = `<div style="${bgImage}padding:48px 24px;text-align:center;color:${p.textColor};font-family:${settings.fontFamily};">
        <div style="font-size:28px;font-weight:700;line-height:1.2;">${escapeHtml(p.title)}</div>
        <div style="margin-top:8px;font-size:16px;opacity:.9;">${escapeHtml(p.subtitle)}</div>${cta}
      </div>`;
      return wrap(inner);
    }
    case "card": {
      const p = block.props as CardProps;
      const cta = p.ctaText
        ? `<div style="margin-top:12px;"><a href="${escapeHtml(p.ctaHref)}" target="_blank" rel="noopener" style="color:${settings.linkColor};text-decoration:none;font-weight:600;">${escapeHtml(p.ctaText)} →</a></div>`
        : "";
      return wrap(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${p.borderColor};border-radius:${p.borderRadius}px;"><tr><td style="padding:20px;font-family:${settings.fontFamily};color:${settings.textColor};">
        <div style="font-size:18px;font-weight:700;margin-bottom:8px;">${escapeHtml(p.title)}</div>
        <div style="font-size:15px;line-height:1.5;">${escapeHtml(p.body)}</div>${cta}
      </td></tr></table>`);
    }
    case "event": {
      const p = block.props as EventProps;
      return wrap(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e5e7eb;border-radius:12px;background:#f9fafb;"><tr><td style="padding:20px;font-family:${settings.fontFamily};color:${settings.textColor};">
        <div style="font-size:18px;font-weight:700;">${escapeHtml(p.title)}</div>
        <div style="margin-top:8px;font-size:14px;color:#374151;">📅 ${escapeHtml(p.dateLabel)} · 🕒 ${escapeHtml(p.timeLabel)}</div>
        <div style="margin-top:4px;font-size:14px;color:#374151;">📍 ${escapeHtml(p.location)}</div>
        <div style="margin-top:14px;"><a href="${escapeHtml(p.ctaHref)}" target="_blank" rel="noopener" style="background:${settings.linkColor};color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600;display:inline-block;">${escapeHtml(p.ctaText)}</a></div>
      </td></tr></table>`);
    }
    case "social": {
      const p = block.props as SocialProps;
      const icons: Record<string, string> = {
        twitter: "https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/x.svg",
        linkedin: "https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/linkedin.svg",
        facebook: "https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/facebook.svg",
        instagram: "https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/instagram.svg",
        youtube: "https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/youtube.svg",
        website: "https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/safari.svg",
      };
      const items = p.links.map((l) =>
        `<a href="${escapeHtml(l.href)}" target="_blank" rel="noopener" style="display:inline-block;margin:0 6px;"><img src="${icons[l.network]}" alt="${l.network}" width="20" height="20" style="display:inline-block;border:0;" /></a>`
      ).join("");
      return wrap(`<div style="text-align:${p.align};">${items}</div>`);
    }
    case "footer": {
      const p = block.props as FooterProps;
      return wrap(`<div style="text-align:center;font-family:${settings.fontFamily};color:${p.color};font-size:12px;line-height:1.6;">
        <div style="font-weight:600;">${escapeHtml(p.companyName)}</div>
        <div>${escapeHtml(p.address)}</div>
      </div>`);
    }
    case "unsubscribe": {
      const p = block.props as UnsubscribeProps;
      return wrap(`<div style="text-align:center;font-family:${settings.fontFamily};color:${p.color};font-size:12px;">
        <a href="{{unsubscribe_url}}" style="color:${p.color};text-decoration:underline;">${escapeHtml(p.text)}</a>
      </div>`);
    }
    case "html": {
      // Raw HTML — left as-is (advanced users only).
      return wrap(block.props.html || "");
    }
  }
}

export function hasUnsubscribe(doc: BuilderDoc): boolean {
  return doc.blocks.some((b) => b.type === "unsubscribe") || doc.blocks.some(
    (b) => b.type === "html" && /unsubscribe_url|unsubscribe/i.test(b.props.html)
  );
}

export function renderEmailHtml(doc: BuilderDoc, opts?: { preheader?: string; subject?: string }): string {
  const s = doc.settings;
  const body = doc.blocks.map((b) => renderBlock(b, s)).join("");
  const preheader = opts?.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:transparent;">${escapeHtml(opts.preheader)}</div>`
    : "";
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<title>${escapeHtml(opts?.subject || "")}</title>
<style>
  body { margin:0; padding:0; background:${s.backgroundColor}; -webkit-font-smoothing:antialiased; }
  a { color:${s.linkColor}; }
  img { -ms-interpolation-mode:bicubic; }
  table { border-collapse:collapse; }
  .container { width:100%; max-width:${s.contentWidth}px; }
  @media only screen and (max-width:600px) {
    .container { width:100% !important; }
    .col-stack { display:block !important; width:100% !important; padding:8px 0 !important; }
    .hide-mobile { display:none !important; }
  }
  @media only screen and (min-width:601px) {
    .hide-desktop { display:none !important; }
  }
</style>
</head><body style="background:${s.backgroundColor};font-family:${s.fontFamily};color:${s.textColor};">
${preheader}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${s.backgroundColor};">
  <tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" class="container" width="${s.contentWidth}" cellpadding="0" cellspacing="0" border="0" style="background:${s.contentBackground};border-radius:8px;overflow:hidden;">
      ${body}
    </table>
  </td></tr>
</table>
</body></html>`;
}

export function renderPlainText(doc: BuilderDoc): string {
  const lines: string[] = [];
  const walk = (blocks: Block[]) => {
    for (const b of blocks) {
      switch (b.type) {
        case "heading":
          lines.push("", b.props.text.toUpperCase(), ""); break;
        case "paragraph":
        case "text":
          lines.push(b.props.text, ""); break;
        case "button":
          lines.push(`${b.props.text}: ${b.props.href}`, ""); break;
        case "image":
        case "logo":
          if (b.props.alt) lines.push(`[${b.props.alt}]`);
          break;
        case "divider":
          lines.push("------------------------------"); break;
        case "columns":
          for (const col of b.props.columns) walk(col);
          break;
        case "hero":
          lines.push(b.props.title, b.props.subtitle, b.props.ctaText ? `${b.props.ctaText}: ${b.props.ctaHref}` : "", "");
          break;
        case "card":
          lines.push(b.props.title, b.props.body, b.props.ctaText ? `${b.props.ctaText}: ${b.props.ctaHref}` : "", "");
          break;
        case "event":
          lines.push(b.props.title, `${b.props.dateLabel} · ${b.props.timeLabel}`, b.props.location, `${b.props.ctaText}: ${b.props.ctaHref}`, "");
          break;
        case "footer":
          lines.push(b.props.companyName, b.props.address, ""); break;
        case "unsubscribe":
          lines.push("Unsubscribe: {{unsubscribe_url}}"); break;
      }
    }
  };
  walk(doc.blocks);
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
