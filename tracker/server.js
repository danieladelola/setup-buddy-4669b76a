// Standalone tracking service for mail.afrisafe.org.
// Serves ONLY the endpoints embedded in already-sent emails:
//   /api/track/click/:token   /api/track/open/:token   /api/unsubscribe/:token
//   legacy aliases: /t/c/:token  /t/o/:token  /u/:token
// It shares TRACKING_SECRET and the database with the main app, and never
// generates or rewrites tokens.
import express from "express";
import postgres from "postgres";
import { verifyPayload, PIXEL_GIF, safeRedirectUrl } from "./tracking.js";

const PORT = Number(process.env.PORT || 8090);
const HOST = process.env.HOST || "127.0.0.1";

let sql = null;
function db() {
  if (!process.env.DATABASE_URL) return null;
  if (!sql) {
    sql = postgres(process.env.DATABASE_URL, {
      max: 4,
      idle_timeout: 20,
      ssl: process.env.PGSSL === "require" ? "require" : undefined,
    });
  }
  return sql;
}

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", true);
app.use(express.urlencoded({ extended: false }));

const esc = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const page = (title, body) =>
  `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>body{font-family:system-ui,sans-serif;max-width:520px;margin:80px auto;padding:0 24px;color:#111}
h1{font-size:22px;margin:0 0 12px}p{color:#555;line-height:1.5}
button,a.btn{display:inline-block;background:#111;color:#fff;border:0;padding:10px 16px;border-radius:6px;text-decoration:none;cursor:pointer}
</style></head><body>${body}</body></html>`;

app.get("/health", (_req, res) => res.json({ ok: true, service: "hsemail-tracker" }));

// ---- click ---------------------------------------------------------------
async function click(req, res) {
  const data = verifyPayload(req.params.token);
  if (!data?.u) return res.status(400).type("text/plain").send("Invalid link");
  const safeUrl = safeRedirectUrl(data.u);
  if (!safeUrl) return res.status(400).type("text/plain").send("Invalid link");

  if (data.q && data.q !== "test") {
    try {
      const s = db();
      if (s) {
        const qid = data.q;
        const cid = data.c ?? null;
        await s`UPDATE email_queue
                SET clicked_at = COALESCE(clicked_at, now()),
                    opened_at = COALESCE(opened_at, now()),
                    status = CASE WHEN status IN ('sent','delivered','opened') THEN 'clicked' ELSE status END
                WHERE id = ${qid}`;
        await s`INSERT INTO campaign_events (campaign_id, queue_id, event_type, metadata)
                VALUES (${cid}, ${qid}, 'click', ${s.json({ url: safeUrl })})`;
      }
    } catch (e) {
      console.error("click track error", e);
    }
  }
  res.setHeader("Cache-Control", "no-store");
  return res.redirect(302, safeUrl);
}

// ---- open ----------------------------------------------------------------
async function open(req, res) {
  const data = verifyPayload(req.params.token);
  if (data?.q && data.q !== "test") {
    try {
      const s = db();
      if (s) {
        const qid = data.q;
        const cid = data.c ?? null;
        await s`UPDATE email_queue
                SET opened_at = COALESCE(opened_at, now()),
                    status = CASE WHEN status IN ('sent','delivered') THEN 'opened' ELSE status END
                WHERE id = ${qid}`;
        await s`INSERT INTO campaign_events (campaign_id, queue_id, event_type)
                VALUES (${cid}, ${qid}, 'open')`;
      }
    } catch (e) {
      console.error("open track error", e);
    }
  }
  res.status(200);
  res.setHeader("Content-Type", "image/gif");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  return res.end(PIXEL_GIF);
}

// ---- unsubscribe ---------------------------------------------------------
async function unsubGet(req, res, actionPath) {
  const s = db();
  if (!s) return res.status(500).send(page("Unavailable", "<h1>Temporarily unavailable</h1>"));
  const rows = await s`
    SELECT t.token, c.email
    FROM unsubscribe_tokens t
    JOIN contacts c ON c.id = t.contact_id
    WHERE t.token = ${req.params.token}`;
  if (!rows[0]) return res.status(404).send(page("Invalid link", "<h1>Invalid link</h1>"));
  return res.status(200).send(
    page(
      "Unsubscribe",
      `<h1>Unsubscribe ${esc(rows[0].email)}?</h1>
       <p>Click the button below to stop receiving emails from HSENations.</p>
       <form method="POST" action="${esc(actionPath)}"><button type="submit">Unsubscribe me</button></form>`,
    ),
  );
}

async function unsubPost(req, res) {
  const s = db();
  if (!s) return res.status(500).send(page("Unavailable", "<h1>Temporarily unavailable</h1>"));
  const token = req.params.token;
  const rows = await s`
    SELECT t.contact_id, t.campaign_id, c.email
    FROM unsubscribe_tokens t
    JOIN contacts c ON c.id = t.contact_id
    WHERE t.token = ${token}`;
  if (!rows[0]) return res.status(404).send(page("Invalid link", "<h1>Invalid link</h1>"));
  const { contact_id, campaign_id, email } = rows[0];

  await s`UPDATE contacts
          SET unsubscribed = true, unsubscribed_at = COALESCE(unsubscribed_at, now()),
              status = 'unsubscribed'
          WHERE id = ${contact_id}`;

  await s`INSERT INTO suppressed_emails (email, reason, source, campaign_id, contact_id, details)
          VALUES (${email.toLowerCase()}, 'unsubscribe', 'unsubscribe_link', ${campaign_id},
                  ${contact_id}, ${s.json({ token })})
          ON CONFLICT (email) DO UPDATE SET
            reason = EXCLUDED.reason,
            source = EXCLUDED.source`;

  if (campaign_id) {
    await s`INSERT INTO campaign_events (campaign_id, event_type, metadata)
            VALUES (${campaign_id}, 'unsubscribe', ${s.json({ contact_id, email })})`;
  }
  return res
    .status(200)
    .send(page("Unsubscribed", "<h1>You're unsubscribed</h1><p>We won't email you again.</p>"));
}

// routes (canonical + legacy aliases used by older sends)
app.get("/api/track/click/:token", click);
app.get("/t/c/:token", click);
app.get("/api/track/open/:token", open);
app.get("/t/o/:token", open);
app.get("/api/unsubscribe/:token", (req, res) =>
  unsubGet(req, res, `/api/unsubscribe/${req.params.token}`),
);
app.post("/api/unsubscribe/:token", unsubPost);
app.get("/u/:token", (req, res) => unsubGet(req, res, `/u/${req.params.token}`));
app.post("/u/:token", unsubPost);

app.use((_req, res) => res.status(404).type("text/plain").send("Not found"));

app.listen(PORT, HOST, () => {
  console.log(`hsemail-tracker listening on http://${HOST}:${PORT}`);
});
