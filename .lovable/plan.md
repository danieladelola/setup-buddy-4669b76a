# Coolify deployment plan — tracker only

Goal: existing Brevo link `https://mail.afrisafe.org/api/track/click/<token>` → 75.119.138.228 → tracker container → verifies with the current `TRACKING_SECRET` → 302 to the original Google Form/Drive URL. No resend, no Brevo/SES/APP_URL/DNS/schema changes.

## 1. What to deploy

Deploy **only the tracker** as its own Coolify resource. Do not deploy the root `docker-compose.yml` (it also builds the admin app and binds host ports, which Coolify does not need).

In Coolify:
- Project → **New Resource → Application → Dockerfile** (private/public Git source = this repo).
- Branch: your deploy branch.
- **Base directory / Build context:** `/tracker`
- **Dockerfile location:** `/tracker/Dockerfile`
- **Exposed port:** `8090` (Coolify calls this "Ports Exposes"). Leave "Ports Mappings" empty — no host port publishing needed; Traefik reaches the container over the Coolify network.
- Health check path: `/health`

## 2. Environment variables (Coolify → the tracker app → Environment Variables)

| Name | Value | Notes |
|---|---|---|
| `TRACKING_SECRET` | exactly the current value from the app `.env` (`8d9c4375…f97c3`) | Must be byte-identical. Never rotate. Mark as secret/build-time = off. |
| `DATABASE_URL` | the same Postgres URL as the app (`postgres://postgres:…@75.119.138.228:2870/postgres`) | Only used for click/open logging + unsubscribe. Redirects work without it. |
| `PORT` | `8090` | |
| `HOST` | `0.0.0.0` | Required inside a container; the container is still not publicly reachable except via Traefik. |
| `PGSSL` | leave unset | Set to `require` only if Postgres enforces TLS. |

Nothing else. No Brevo, no SES, no `APP_URL` in this service.

## 3. Domain and HTTPS

- In the tracker app → **Domains**, set: `https://mail.afrisafe.org`
- Coolify's built-in Traefik terminates TLS and issues the Let's Encrypt certificate automatically (HTTP-01). **No certbot, no systemd, no nginx vhost file.** Delete/ignore `tracker/deploy/*` — those are the fallback path only.
- Requirement: ports 80/443 on 75.119.138.228 must be owned by Coolify's proxy. If a host nginx already owns 80/443 for the main website, then **either**
  - (a) keep nginx in front and add one new vhost proxying `mail.afrisafe.org` → the tracker (then set the Coolify port mapping to `127.0.0.1:8090:8090` and let nginx/certbot handle TLS), **or**
  - (b) if Coolify's proxy already serves your other apps, do nothing extra — just set the domain.
  Which case applies is the only thing to check before deploying; the main site config is not modified in either case.
- Cloudflare: if `mail.afrisafe.org` is orange-clouded, set SSL mode **Full (strict)**, or grey-cloud it during first certificate issuance.

## 4. DNS

No change. `mail.afrisafe.org` A record stays on `75.119.138.228`. No other record is touched.

## 5. Deploy + smoke test

1. Click **Deploy**. Wait for healthy.
2. `curl -s https://mail.afrisafe.org/health` → `{"ok":true,"service":"hsemail-tracker"}`

## 6. Validate with a real link from one of the 96 delivered emails

Primary test (required): open one of the 96 delivered Brevo emails, right-click a button → **Copy link address**. It will look like `https://mail.afrisafe.org/api/track/click/<token>`.

```bash
curl -sSI "https://mail.afrisafe.org/api/track/click/<PASTE_REAL_TOKEN>"
```

Pass criteria:
- `HTTP/2 302`
- `location:` equals the original destination (the Google Form `https://forms.gle/…` or the Drive `/view` URL)
- not `400 Invalid link` — that would mean `TRACKING_SECRET` differs from the send-time value

Repeat for the **second** button in the same email.

Open pixel: `curl -sSI "https://mail.afrisafe.org/api/track/open/<TOKEN>"` → `200`, `content-type: image/gif`.

Click logging (optional confirmation):

```sql
SELECT status, opened_at, clicked_at FROM email_queue WHERE id = '<queue-id-from-token>';
SELECT event_type, metadata, created_at FROM campaign_events ORDER BY created_at DESC LIMIT 5;
```

## 7. If anything fails

Stop and report the exact output. Do not change Brevo, SES, `APP_URL`, `TRACKING_SECRET`, DNS, the database schema, or the main website.

## 8. Rollback

Coolify → tracker app → **Stop** (and remove the domain). Nothing else on the server is affected.
