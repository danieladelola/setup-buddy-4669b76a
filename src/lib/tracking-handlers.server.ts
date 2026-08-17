// Shared handler logic for tracking, click, and unsubscribe routes.
// Used by both the canonical /api/... routes and the legacy /t/o, /t/c, /u aliases.

// Batch 5: HTML-escape every interpolated value in the inline pages below.
// These pages are user-facing and the email field comes from the DB / token.
const esc = (s: string) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const page = (title: string, body: string) =>
  `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>body{font-family:system-ui,sans-serif;max-width:520px;margin:80px auto;padding:0 24px;color:#111}
h1{font-size:22px;margin:0 0 12px}p{color:#555;line-height:1.5}
button,a.btn{display:inline-block;background:#111;color:#fff;border:0;padding:10px 16px;border-radius:6px;text-decoration:none;cursor:pointer}
</style></head><body>${body}</body></html>`;

const html = (body: string, status = 200) =>
  new Response(body, { status, headers: { "Content-Type": "text/html; charset=utf-8" } });


export async function handleOpenTracking(token: string): Promise<Response> {
  const { verifyPayload, PIXEL_GIF } = await import("@/lib/tracking.server");
  const data = verifyPayload<{ q?: string; c?: string }>(token);

  if (data?.q && data.q !== "test") {
    try {
      const { db } = await import("@/lib/db.server");
      const sql = db();
      const qid = data.q;
      const cid = data.c ?? null;
      await sql`UPDATE email_queue
                SET opened_at = COALESCE(opened_at, now()),
                    status = CASE WHEN status IN ('sent','delivered') THEN 'opened' ELSE status END
                WHERE id = ${qid}`;
      await sql`INSERT INTO campaign_events (campaign_id, queue_id, event_type)
                VALUES (${cid}, ${qid}, 'open')`;
    } catch (e) {
      console.error("open track error", e);
    }
  }

  const body = new Uint8Array(PIXEL_GIF);
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, private",
    },
  });
}

export async function handleClickTracking(token: string): Promise<Response> {
  const { verifyPayload } = await import("@/lib/tracking.server");
  const { safeRedirectUrl } = await import("@/lib/sanitize.server");
  const data = verifyPayload<{ q?: string; c?: string; u?: string }>(token);
  if (!data?.u) return new Response("Invalid link", { status: 400 });

  // Batch 5: redirect target must be http(s). Anything else (javascript:, data:,
  // file:, vbscript:, malformed) is rejected — protects against open-redirect
  // payloads in case the signing secret ever leaks.
  const safeUrl = safeRedirectUrl(data.u);
  if (!safeUrl) return new Response("Invalid link", { status: 400 });

  if (data.q && data.q !== "test") {
    try {
      const { db } = await import("@/lib/db.server");
      const sql = db();
      const qid = data.q;
      const cid = data.c ?? null;
      await sql`UPDATE email_queue
                SET clicked_at = COALESCE(clicked_at, now()),
                    opened_at = COALESCE(opened_at, now()),
                    status = CASE WHEN status IN ('sent','delivered','opened') THEN 'clicked' ELSE status END
                WHERE id = ${qid}`;
      await sql`INSERT INTO campaign_events (campaign_id, queue_id, event_type, metadata)
                VALUES (${cid}, ${qid}, 'click', ${sql.json({ url: safeUrl })})`;
    } catch (e) {
      console.error("click track error", e);
    }
  }

  return new Response(null, { status: 302, headers: { Location: safeUrl } });
}


export async function handleUnsubscribeGet(token: string, actionPath: string): Promise<Response> {
  const { db } = await import("@/lib/db.server");
  const sql = db();
  const rows = await sql<{ token: string; email: string }[]>`
    SELECT t.token, c.email
    FROM unsubscribe_tokens t
    JOIN contacts c ON c.id = t.contact_id
    WHERE t.token = ${token}`;
  if (!rows[0]) return html(page("Invalid link", `<h1>Invalid link</h1>`), 404);
  return html(
    page(
      "Unsubscribe",
      `<h1>Unsubscribe ${esc(rows[0].email)}?</h1>
       <p>Click the button below to stop receiving emails from HSENations.</p>
       <form method="POST" action="${esc(actionPath)}"><button type="submit">Unsubscribe me</button></form>`,
    ),
  );
}


export async function handleUnsubscribePost(token: string): Promise<Response> {
  const { db } = await import("@/lib/db.server");
  const { addSuppression } = await import("@/lib/suppression.server");
  const sql = db();
  const rows = await sql<{ contact_id: string; campaign_id: string | null; email: string }[]>`
    SELECT t.contact_id, t.campaign_id, c.email
    FROM unsubscribe_tokens t
    JOIN contacts c ON c.id = t.contact_id
    WHERE t.token = ${token}`;
  if (!rows[0]) return html(page("Invalid link", `<h1>Invalid link</h1>`), 404);
  const { contact_id, campaign_id, email } = rows[0];

  // Mark contact as unsubscribed (idempotent).
  await sql`UPDATE contacts
            SET unsubscribed = true, unsubscribed_at = COALESCE(unsubscribed_at, now()),
                status = 'unsubscribed'
            WHERE id = ${contact_id}`;

  // Belt-and-suspenders: also add to suppression list. This catches the case
  // where the contact is later re-imported / re-added (suppression survives).
  await addSuppression({
    email,
    reason: "unsubscribe",
    source: "unsubscribe_link",
    contactId: contact_id,
    campaignId: campaign_id,
    details: { token },
  });

  if (campaign_id) {
    await sql`INSERT INTO campaign_events (campaign_id, event_type, metadata)
              VALUES (${campaign_id}, 'unsubscribe', ${sql.json({ contact_id, email })})`;
  }
  return html(page("Unsubscribed", `<h1>You're unsubscribed</h1><p>We won't email you again.</p>`));
}

