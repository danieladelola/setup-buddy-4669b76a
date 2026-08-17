import {
  Heading, Type, Image, MousePointerClick, Minus, Move, Columns2,
  Star, CreditCard, CalendarDays, Share2, FileText, Link as LinkIcon,
  Code2, ImageIcon,
} from "lucide-react";
import type { BlockType } from "./types";

export type BlockMeta = {
  type: BlockType;
  label: string;
  icon: any;
  group: "content" | "layout" | "section";
  description?: string;
};

export const BLOCKS: BlockMeta[] = [
  { type: "heading",     label: "Heading",     icon: Heading,           group: "content" },
  { type: "paragraph",   label: "Paragraph",   icon: Type,              group: "content" },
  { type: "text",        label: "Text",        icon: FileText,          group: "content" },
  { type: "image",       label: "Image",       icon: ImageIcon,         group: "content" },
  { type: "logo",        label: "Logo",        icon: Image,             group: "content" },
  { type: "button",      label: "Button",      icon: MousePointerClick, group: "content" },
  { type: "divider",     label: "Divider",     icon: Minus,             group: "layout"  },
  { type: "spacer",      label: "Spacer",      icon: Move,              group: "layout"  },
  { type: "columns",     label: "Columns",     icon: Columns2,          group: "layout"  },
  { type: "hero",        label: "Hero",        icon: Star,              group: "section" },
  { type: "card",        label: "Card",        icon: CreditCard,        group: "section" },
  { type: "event",       label: "Event",       icon: CalendarDays,      group: "section" },
  { type: "social",      label: "Social",      icon: Share2,            group: "section" },
  { type: "footer",      label: "Footer",      icon: LinkIcon,          group: "section" },
  { type: "unsubscribe", label: "Unsubscribe", icon: LinkIcon,          group: "section" },
  { type: "html",        label: "Custom HTML", icon: Code2,             group: "section" },
];
