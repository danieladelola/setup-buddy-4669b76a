# hsemail-tracker

Standalone service that answers the tracking URLs already embedded in the 96
AfriSAFE 2026 emails delivered through Brevo:

```
https://mail.afrisafe.org/api/track/click/<token>
https://mail.afrisafe.org/api/track/open/<token>
https://mail.afrisafe.org/api/unsubscribe/<token>
```

It reuses the exact signing/verification logic from
`src/lib/tracking.server.ts` and the **existing** `TRACKING_SECRET`. No token is
regenerated, no email is resent, `APP_URL` is unchanged.

Why this works: the click token is
`base64url(JSON).base64url(HMAC-SHA256(payload, TRACKING_SECRET))` and the JSON
payload already contains the original destination URL (`u`). Verifying the
signature is enough to redirect — the database is only used to record analytics
and is fully optional for the redirect path.

## Deploy (run on 75.119.138.228)

Nothing below touches your website, other vhosts, DNS records for
`afrisafe.org`, Brevo, SES, or the database schema.

```bash
# 1. Node 18+ (skip if already installed)
node -v || curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs

# 2. Copy the service files
sudo mkdir -p /opt/hsemail-tracker
sudo cp server.js tracking.js package.json /opt/hsemail-tracker/
cd /opt/hsemail-tracker && sudo npm install --omit=dev

# 3. Environment (paste the SAME TRACKING_SECRET and DATABASE_URL as the app .env)
sudo cp /path/to/tracker/.env.example /opt/hsemail-tracker/.env
sudo nano /opt/hsemail-tracker/.env
sudo chown -R www-data:www-data /opt/hsemail-tracker
sudo chmod 600 /opt/hsemail-tracker/.env

# 4. systemd unit
sudo cp deploy/hsemail-tracker.service /etc/systemd/system/hsemail-tracker.service
sudo systemctl daemon-reload
sudo systemctl enable --now hsemail-tracker
systemctl status hsemail-tracker --no-pager
curl -s http://127.0.0.1:8090/health      # -> {"ok":true,...}

# 5. nginx vhost (new file only)
sudo cp deploy/mail.afrisafe.org.conf /etc/nginx/sites-available/mail.afrisafe.org.conf
sudo ln -s /etc/nginx/sites-available/mail.afrisafe.org.conf /etc/nginx/sites-enabled/
sudo nginx -t          # must print "syntax is ok" / "test is successful"
sudo systemctl reload nginx

# 6. SSL
#    mail.afrisafe.org is proxied by Cloudflare. Either:
#    (a) grey-cloud the record for ~5 minutes, then:
sudo certbot --nginx -d mail.afrisafe.org
#        ...then re-enable the orange cloud and set SSL mode to "Full (strict)"; or
#    (b) keep the proxy on and use DNS-01:
sudo certbot certonly --manual --preferred-challenges dns -d mail.afrisafe.org
#    Afterwards, uncomment the 443 block in the vhost (certbot --nginx does it
#    for you) and change the port-80 location / to:  return 301 https://$host$request_uri;
sudo nginx -t && sudo systemctl reload nginx
```

If your existing site uses Apache instead of nginx, the equivalent vhost is a
`<VirtualHost>` for `mail.afrisafe.org` with
`ProxyPass / http://127.0.0.1:8090/` and `ProxyPassReverse / http://127.0.0.1:8090/`.

## Environment variables

| Name | Required | Notes |
|---|---|---|
| `TRACKING_SECRET` | yes | Must be **identical** to the main app's value. Do not rotate. |
| `DATABASE_URL` | recommended | Same Postgres as the app; used for click/open analytics + unsubscribe. Redirects work without it. |
| `HOST` | no | Default `127.0.0.1`. |
| `PORT` | no | Default `8090`. |
| `PGSSL` | no | Set to `require` if Postgres needs TLS. |

## Validating with a real token from the 96 sent emails

The click token is a deterministic HMAC of `{q: queueId, c: campaignId, u: destinationUrl}`,
so the exact token that went out in an email can be reproduced locally from the
queue row — no need to dig through inboxes (though copying a button link out of a
delivered email works too and is the strongest proof).

1. Get a real queue id from the sent campaign:

```sql
SELECT id, contact_id, status FROM email_queue
WHERE campaign_id = '4c4fa32e-a111-4982-b91b-15f451d38a27'
  AND status IN ('sent','delivered','opened','clicked')
LIMIT 1;
```

2. Reproduce the mailed token (run from the tracker directory, with
   `TRACKING_SECRET` set to the same value used at send time):

```bash
TRACKING_SECRET=... node -e "import('./tracking.js').then(({signPayload})=>console.log(signPayload({q:'<QUEUE_ID>',c:'4c4fa32e-a111-4982-b91b-15f451d38a27',u:'https://forms.gle/mZp7ov3MHfaVuGce8'})))"
```

   This prints the identical token string that appears in that recipient's email.

3. Verify locally first (no DNS/SSL involved):

```bash
curl -sSI "http://127.0.0.1:8090/api/track/click/<TOKEN>"
```

4. Then through the public hostname:

```bash
curl -sSI "https://mail.afrisafe.org/api/track/click/<TOKEN>"
```

**Pass criteria**

- Status line: `HTTP/1.1 302 Found` (or `HTTP/2 302`)
- `Location:` header equals the original destination, e.g.
  `https://forms.gle/mZp7ov3MHfaVuGce8` or the Google Drive `/view` URL
- No `400 Invalid link` — that would mean the secret differs from the one used
  at send time
- `SELECT clicked_at, status FROM email_queue WHERE id = '<QUEUE_ID>'` shows the
  click recorded, and a `click` row appears in `campaign_events`

Also confirm the open pixel: `curl -sSI https://mail.afrisafe.org/api/track/open/<TOKEN>`
returns `200` with `Content-Type: image/gif`.

## Rollback

```bash
sudo systemctl disable --now hsemail-tracker
sudo rm /etc/nginx/sites-enabled/mail.afrisafe.org.conf
sudo nginx -t && sudo systemctl reload nginx
```

Nothing else on the server is affected.
