import type { Block, BlockType, BuilderDoc, EmailSettings } from "./types";

export const defaultSettings: EmailSettings = {
  contentWidth: 600,
  backgroundColor: "#f4f5f7",
  contentBackground: "#ffffff",
  fontFamily: "Arial, Helvetica, sans-serif",
  textColor: "#1f2937",
  linkColor: "#2563eb",
};

let counter = 0;
export const newId = () => `b_${Date.now().toString(36)}_${(counter++).toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

export function defaultBlock(type: BlockType): Block {
  const id = newId();
  switch (type) {
    case "heading":
      return { id, type, props: { text: "Welcome to HSENations", level: 1, align: "center", color: "#111827", fontSize: 28, fontWeight: 700, paddingTop: 16, paddingBottom: 8, paddingX: 24 } };
    case "paragraph":
    case "text":
      return { id, type, props: { text: "Write something compelling here. Use this paragraph block to introduce your update, share an insight, or invite readers to take action.", align: "left", color: "#374151", fontSize: 16, lineHeight: 1.6, paddingTop: 8, paddingBottom: 8, paddingX: 24 } };
    case "image":
      return { id, type, props: { src: "https://placehold.co/600x300/4f46e5/ffffff?text=Image", alt: "Image", width: 0, align: "center", borderRadius: 6, paddingTop: 8, paddingBottom: 8, paddingX: 24 } };
    case "logo":
      return { id, type: "image", props: { src: "https://placehold.co/180x60/111827/ffffff?text=LOGO", alt: "Brand logo", width: 180, align: "center", borderRadius: 0, paddingTop: 24, paddingBottom: 8, paddingX: 24 } };
    case "button":
      return { id, type, props: { text: "Get started", href: "https://example.com", bgColor: "#4f46e5", color: "#ffffff", fontSize: 16, fontWeight: 600, borderRadius: 8, align: "center", paddingY: 14, paddingX2: 28, fullWidth: false, paddingTop: 12, paddingBottom: 12, paddingX: 24 } };
    case "divider":
      return { id, type, props: { color: "#e5e7eb", thickness: 1, paddingTop: 12, paddingBottom: 12, paddingX: 24 } };
    case "spacer":
      return { id, type, props: { height: 24 } };
    case "columns":
      return {
        id, type, props: {
          ratio: "1:1", gap: 16, stackOnMobile: true,
          paddingTop: 8, paddingBottom: 8, paddingX: 16,
          columns: [
            [{ id: newId(), type: "paragraph", props: { text: "Left column content.", align: "left", color: "#374151", fontSize: 15, lineHeight: 1.5, paddingTop: 4, paddingBottom: 4, paddingX: 8 } }],
            [{ id: newId(), type: "paragraph", props: { text: "Right column content.", align: "left", color: "#374151", fontSize: 15, lineHeight: 1.5, paddingTop: 4, paddingBottom: 4, paddingX: 8 } }],
          ],
        },
      };
    case "hero":
      return { id, type, props: { imageSrc: "https://placehold.co/1200x500/0f172a/ffffff?text=Hero", imageAlt: "Hero image", title: "A bold headline", subtitle: "Short supporting line that explains the value in one breath.", ctaText: "Learn more", ctaHref: "https://example.com", textColor: "#ffffff", overlayColor: "rgba(15,23,42,0.55)", paddingTop: 0, paddingBottom: 0, paddingX: 0 } };
    case "card":
      return { id, type, props: { title: "Card title", body: "Use cards to highlight a single idea, product, or event.", ctaText: "Read more", ctaHref: "https://example.com", borderColor: "#e5e7eb", borderRadius: 12, paddingTop: 8, paddingBottom: 8, paddingX: 24 } };
    case "event":
      return { id, type, props: { title: "Quarterly Safety Summit", dateLabel: "Thu, Sep 18, 2026", timeLabel: "10:00 AM – 12:00 PM WAT", location: "Lagos, Nigeria · Virtual", ctaText: "Register", ctaHref: "https://example.com", paddingTop: 8, paddingBottom: 8, paddingX: 24 } };
    case "social":
      return {
        id, type, props: {
          align: "center", iconColor: "#4f46e5",
          links: [
            { network: "linkedin", href: "https://linkedin.com" },
            { network: "twitter", href: "https://twitter.com" },
            { network: "website", href: "https://example.com" },
          ],
          paddingTop: 16, paddingBottom: 8, paddingX: 24,
        },
      };
    case "footer":
      return { id, type, props: { companyName: "HSENations", address: "© {{year}} HSENations. All rights reserved.", color: "#6b7280", paddingTop: 12, paddingBottom: 8, paddingX: 24 } };
    case "unsubscribe":
      return { id, type, props: { text: "Don't want these emails? Unsubscribe", color: "#6b7280", paddingTop: 8, paddingBottom: 24, paddingX: 24 } };
    case "html":
      return { id, type, props: { html: "<!-- raw HTML --><p style=\"margin:0\">Custom HTML</p>", paddingTop: 8, paddingBottom: 8, paddingX: 24 } };
  }
}

export function emptyDoc(): BuilderDoc {
  return {
    version: 1,
    settings: { ...defaultSettings },
    blocks: [
      defaultBlock("logo"),
      defaultBlock("heading"),
      defaultBlock("paragraph"),
      defaultBlock("button"),
      defaultBlock("divider"),
      defaultBlock("footer"),
      defaultBlock("unsubscribe"),
    ],
  };
}
