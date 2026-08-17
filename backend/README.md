# HSENations Mail — Backend

Node.js + Express + PostgreSQL backend for the HSENations Mail admin tool.
Sends through AWS SES. Receives delivery/bounce/complaint events from AWS SNS.

## Local setup

```bash
cd backend
cp .env.example .env   # fill in real values
npm install
npm run migrate        # creates schema in the DB pointed at by DATABASE_URL
ADMIN_EMAIL=you@hsenations.com ADMIN_PASSWORD=secret npm run seed:admin
npm start              # API on :8080
npm run worker         # in another terminal — sends queued emails
```

## Environment variables

See `.env.example`. Required:

- `DATABASE_URL` — Postgres connection string (use the one from your Coolify Postgres service)
- `JWT_SECRET` — long random string
- `APP_URL` — public URL of the deployed app (used in tracking/unsubscribe links)
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`
- `SES_CONFIGURATION_SET` — SES Configuration Set publishing events to your SNS topic
- `SES_SNS_TOPIC_ARN` — the topic ARN (used in dashboards; subscription is set up in AWS console)
- `DEFAULT_FROM_EMAIL`, `DEFAULT_FROM_NAME`
- `TRACKING_SECRET` — long random string (signs open/click tokens)
- `CORS_ORIGINS` — comma-separated list of allowed frontend origins

## Deploy to Coolify

1. Push this `backend/` folder as its own Git repo (or as a subdirectory in a monorepo with build context set to `backend/`).
2. In Coolify, create two services from the same Dockerfile:
   - **api**: command `node src/server.js`, expose port 8080, attach to the `mail.hsenations.com` domain or a subdomain like `api.mail.hsenations.com`.
   - **worker**: command `node src/worker.js`, no port.
3. Attach the Postgres service via `DATABASE_URL` (internal Coolify network URL recommended).
4. Set all environment variables from `.env.example`.
5. First deploy: open a shell into the api container and run `node src/migrate.js` then `ADMIN_EMAIL=... ADMIN_PASSWORD=... node src/seed-admin.js`.

## AWS SES + SNS wiring

1. Verify your sending domain in SES.
2. Create an **SES Configuration Set** (set its name as `SES_CONFIGURATION_SET`).
3. Create an **SNS topic** and add a subscription:
   - Protocol: HTTPS
   - Endpoint: `https://<your-api-host>/sns`
4. Add the topic as an **event destination** on the configuration set for events:
   `send, delivery, bounce, complaint`.
5. On first POST from AWS, the backend auto-confirms the subscription.

## Endpoints

- `POST /api/auth/login` — `{ email, password }` → `{ token, user }`
- `GET  /api/auth/me`
- `GET  /api/dashboard/stats`
- `GET/POST/PUT/DELETE /api/contacts[/:id]`, `POST /api/contacts/import` (multipart `file`), `GET /api/contacts/export.csv`
- `GET/POST/PUT/DELETE /api/lists[/:id]`, `GET/POST /api/lists/:id/members`, `DELETE /api/lists/:id/members/:contactId`
- `GET/POST/PUT/DELETE /api/templates[/:id]`
- `GET/POST/PUT/DELETE /api/campaigns[/:id]`, `POST /api/campaigns/:id/test`, `POST /api/campaigns/:id/send`, `GET /api/campaigns/:id/report`
- Public: `GET /t/o/:token` (pixel), `GET /t/c/:token` (click redirect), `GET/POST /u/:token` (unsubscribe), `POST /sns` (SNS webhook)

## Notes

- Email queue rows do **not** store full HTML. The campaign body is stored once on `campaigns` and personalised at send time.
- Suppressed addresses (bounces/complaints) are checked before every send.
- Unsubscribed contacts are also skipped.
- Every campaign email has a tracking pixel, click-tracked links, and an unsubscribe footer auto-appended if the template doesn't include `{{unsubscribe_url}}`.
