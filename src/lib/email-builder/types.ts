// Email builder schema. Persisted in email_templates.builder_json.

export type BlockType =
  | "heading"
  | "paragraph"
  | "text"
  | "image"
  | "logo"
  | "button"
  | "divider"
  | "spacer"
  | "columns"
  | "hero"
  | "card"
  | "event"
  | "social"
  | "footer"
  | "unsubscribe"
  | "html";

export type BaseProps = {
  paddingTop?: number;
  paddingBottom?: number;
  paddingX?: number;
  bgColor?: string;
  hiddenOnMobile?: boolean;
  hiddenOnDesktop?: boolean;
};

export type HeadingProps = BaseProps & {
  text: string;
  level: 1 | 2 | 3;
  align: "left" | "center" | "right";
  color: string;
  fontSize: number;
  fontWeight: number;
};

export type ParagraphProps = BaseProps & {
  text: string;
  align: "left" | "center" | "right";
  color: string;
  fontSize: number;
  lineHeight: number;
};

export type ImageProps = BaseProps & {
  src: string;
  alt: string;
  width: number; // 0 = full width
  align: "left" | "center" | "right";
  borderRadius: number;
  href?: string;
};

export type ButtonProps = BaseProps & {
  text: string;
  href: string;
  bgColor: string;
  color: string;
  fontSize: number;
  fontWeight: number;
  borderRadius: number;
  align: "left" | "center" | "right";
  paddingY: number;
  paddingX2: number;
  fullWidth: boolean;
};

export type DividerProps = BaseProps & {
  color: string;
  thickness: number;
};

export type SpacerProps = BaseProps & {
  height: number;
};

export type ColumnsProps = BaseProps & {
  ratio: "1:1" | "1:2" | "2:1" | "1:1:1";
  gap: number;
  stackOnMobile: boolean;
  columns: Block[][];
};

export type HeroProps = BaseProps & {
  imageSrc: string;
  imageAlt: string;
  title: string;
  subtitle: string;
  ctaText: string;
  ctaHref: string;
  textColor: string;
  overlayColor: string;
};

export type CardProps = BaseProps & {
  title: string;
  body: string;
  ctaText: string;
  ctaHref: string;
  borderColor: string;
  borderRadius: number;
};

export type EventProps = BaseProps & {
  title: string;
  dateLabel: string;
  timeLabel: string;
  location: string;
  ctaText: string;
  ctaHref: string;
};

export type SocialProps = BaseProps & {
  align: "left" | "center" | "right";
  links: Array<{ network: "twitter" | "linkedin" | "facebook" | "instagram" | "youtube" | "website"; href: string }>;
  iconColor: string;
};

export type FooterProps = BaseProps & {
  companyName: string;
  address: string;
  color: string;
};

export type UnsubscribeProps = BaseProps & {
  text: string;
  color: string;
};

export type HtmlProps = BaseProps & {
  html: string;
};

export type Block =
  | { id: string; type: "heading"; props: HeadingProps }
  | { id: string; type: "paragraph" | "text"; props: ParagraphProps }
  | { id: string; type: "image" | "logo"; props: ImageProps }
  | { id: string; type: "button"; props: ButtonProps }
  | { id: string; type: "divider"; props: DividerProps }
  | { id: string; type: "spacer"; props: SpacerProps }
  | { id: string; type: "columns"; props: ColumnsProps }
  | { id: string; type: "hero"; props: HeroProps }
  | { id: string; type: "card"; props: CardProps }
  | { id: string; type: "event"; props: EventProps }
  | { id: string; type: "social"; props: SocialProps }
  | { id: string; type: "footer"; props: FooterProps }
  | { id: string; type: "unsubscribe"; props: UnsubscribeProps }
  | { id: string; type: "html"; props: HtmlProps };

export type EmailSettings = {
  contentWidth: number;
  backgroundColor: string;
  contentBackground: string;
  fontFamily: string;
  textColor: string;
  linkColor: string;
};

export type BuilderDoc = {
  version: 1;
  settings: EmailSettings;
  blocks: Block[];
};

export const MERGE_TAGS = [
  { label: "Name", value: "{{name}}" },
  { label: "Email", value: "{{email}}" },
  { label: "Phone", value: "{{phone}}" },
  { label: "Company", value: "{{company}}" },
  { label: "Campaign name", value: "{{campaign_name}}" },
  { label: "Unsubscribe URL", value: "{{unsubscribe_url}}" },
];
