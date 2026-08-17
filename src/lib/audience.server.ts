// Audience computation shared by the campaign preview endpoint and the
// send-claim path. Same query, same filters, same dedupe — so what the
// builder shows matches what gets queued.

import { normalizeEmail, isValidEmail } from "@/lib/suppression.server";

export type AudienceCounts = {
  total: number;
  deliverable: number;
  suppressed: number;
  unsubscribed: number;
  invalid: number;
  duplicate: number;
};

export type DeliverableRecipient = { contact_id: string; email: string };

export async function computeAudience(opts: {
  listIds: string[];
  excludeListIds?: string[];
}): Promise<{ counts: AudienceCounts; recipients: DeliverableRecipient[] }> {
  const { db } = await import("@/lib/db.server");
  const sql = db();

  const lists = opts.listIds.filter(Boolean);
  if (lists.length === 0) {
    return {
      counts: { total: 0, deliverable: 0, suppressed: 0, unsubscribed: 0, invalid: 0, duplicate: 0 },
      recipients: [],
    };
  }
  const excludes = (opts.excludeListIds ?? []).filter(Boolean);
  const hasExcludes = excludes.length > 0;

  const rows = await sql<
    { contact_id: string; email: string; unsubscribed: boolean; suppressed: boolean }[]
  >`
    SELECT DISTINCT ON (c.id)
      c.id AS contact_id,
      lower(c.email) AS email,
      c.unsubscribed,
      EXISTS (SELECT 1 FROM suppressed_emails s WHERE s.email = lower(c.email)) AS suppressed
    FROM contacts c
    JOIN contact_list_members m ON m.contact_id = c.id
    WHERE m.list_id = ANY(${lists})
      AND (${!hasExcludes}::boolean OR NOT EXISTS (
        SELECT 1 FROM contact_list_members me
        WHERE me.contact_id = c.id AND me.list_id = ANY(${hasExcludes ? excludes : lists})
      ))`;

  const total = rows.length;
  let unsubscribed = 0;
  let suppressed = 0;
  let invalid = 0;
  let duplicate = 0;
  const seen = new Set<string>();
  const recipients: DeliverableRecipient[] = [];

  for (const r of rows) {
    const email = normalizeEmail(r.email);
    if (!isValidEmail(email)) { invalid++; continue; }
    if (r.unsubscribed) { unsubscribed++; continue; }
    if (r.suppressed) { suppressed++; continue; }
    if (seen.has(email)) { duplicate++; continue; }
    seen.add(email);
    recipients.push({ contact_id: r.contact_id, email });
  }

  return {
    counts: { total, deliverable: recipients.length, suppressed, unsubscribed, invalid, duplicate },
    recipients,
  };
}
