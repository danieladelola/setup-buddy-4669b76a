// Single source of truth for {{ }} merge tags used by campaign sends and test sends.

export type MergeContact = {
  name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  award_category?: string | null;
};

export function contactName(c: MergeContact, fallback = "there"): string {
  const explicit = (c.name || "").trim();
  if (explicit) return explicit;
  const joined = [c.first_name, c.last_name]
    .map((p) => (p || "").trim())
    .filter(Boolean)
    .join(" ")
    .trim();
  return joined || fallback;
}

export function buildMergeTags(
  c: MergeContact,
  extras: Record<string, string> = {},
): Record<string, string> {
  return {
    name: contactName(c),
    email: (c.email || "").trim(),
    phone: (c.phone || "").trim(),
    company: (c.company || "").trim(),
    award_category: (c.award_category || "").trim(),
    ...extras,
  };
}

/** Replaces {{tag}} (whitespace-tolerant). Unknown tags are left untouched. */
export function applyMergeTags(input: string | null | undefined, tags: Record<string, string>) {
  if (!input) return input ?? "";
  return input.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, key: string) => {
    const v = tags[key];
    return v === undefined ? _m : v;
  });
}
