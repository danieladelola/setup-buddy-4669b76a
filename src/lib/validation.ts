// Batch 5: Zod schemas shared by mutating API routes.
// Keep these tight and user-friendly — error messages surface in the UI.
import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Email is required")
  .max(254, "Email is too long")
  .email("Invalid email address");

const shortText = (label: string, max = 200) =>
  z.string().trim().min(1, `${label} is required`).max(max, `${label} is too long`);

const optionalShort = (max = 200) =>
  z.string().trim().max(max).optional().nullable().transform((v) => v || null);

// ---- Contacts ----
export const contactCreateSchema = z.object({
  email: emailSchema,
  first_name: optionalShort(120),
  last_name: optionalShort(120),
  phone: optionalShort(60),
  company: optionalShort(200),
  job_title: optionalShort(200),
  award_category: optionalShort(200),
  status: z.enum(["subscribed", "unsubscribed", "bounced", "pending"]).optional(),
  source: optionalShort(60),
  notes: z.string().trim().max(2000).optional().nullable(),
  list_ids: z.array(z.string().uuid()).max(50).optional(),
});

export const contactUpdateSchema = contactCreateSchema.partial();

// ---- Lists ----
export const listCreateSchema = z.object({
  name: shortText("Name", 120),
  description: z.string().trim().max(1000).optional().nullable(),
});

// ---- Templates ----
export const templateCreateSchema = z.object({
  name: shortText("Name", 200),
  subject: z.string().trim().max(500).optional(),
  html_body: z.string().max(1_000_000).optional(),
  text_body: z.string().max(500_000).optional().nullable(),
  preview_text: z.string().max(500).optional().nullable(),
  from_name: optionalShort(120),
  status: z.enum(["draft", "ready", "archived"]).optional(),
  tags: z.array(z.string().max(60)).max(50).optional(),
  builder_json: z.unknown().optional(),
});

export const templateUpdateSchema = templateCreateSchema.partial();

// ---- Campaigns ----
export const campaignCreateSchema = z.object({
  name: shortText("Name", 200),
  // Multi-list: every selected list is included in the send audience.
  list_ids: z.array(z.string().uuid("Invalid list")).min(1, "Pick at least one list").max(50),
  template_id: z.string().uuid().optional().nullable(),
  subject: shortText("Subject", 500),
  html_body: z.string().min(1, "Email body is required").max(1_000_000),
  text_body: z.string().max(500_000).optional().nullable(),
  from_email: emailSchema,
  from_name: shortText("From name", 120),
  reply_to: emailSchema.optional().nullable(),
  provider: z.enum(["ses", "brevo"]).optional().nullable(),
  scheduled_at: z.string().datetime().optional().nullable(),
});

// ---- Suppression ----
export const suppressionAddSchema = z.object({
  email: emailSchema,
  reason: z.enum(["bounce", "complaint", "manual"]).optional(),
});

// ---- Test send ----
export const testSendSchema = z.object({
  to: emailSchema.optional(),
  email: emailSchema.optional(),
  preview_email: emailSchema.optional(),
  name: z.string().max(200).optional(),
  award_category: z.string().max(200).optional(),
  provider: z.enum(["ses", "brevo"]).optional(),
}).refine((v) => v.to || v.email, { message: "Recipient email required" });

/** Format a ZodError into a user-friendly { error, fields } payload. */
export function zerr(e: z.ZodError): { error: string; fields: Record<string, string> } {
  const fields: Record<string, string> = {};
  for (const issue of e.issues) {
    const path = issue.path.join(".") || "_";
    if (!fields[path]) fields[path] = issue.message;
  }
  const first = e.issues[0]?.message || "Invalid input";
  return { error: first, fields };
}
