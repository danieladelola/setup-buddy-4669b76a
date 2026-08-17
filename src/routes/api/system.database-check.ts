import { createFileRoute } from "@tanstack/react-router";

// Diagnostic endpoint: proves which Postgres the running app is connected to.
// Returns identity + table fingerprints. Never returns the password or full DSN.
// Admin-only — exposes DB host, user, and row counts.
export const Route = createFileRoute("/api/system/database-check")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { requireAuth } = await import("@/lib/server-auth");
        const auth = await requireAuth(request);
        if (auth instanceof Response) return auth;

        const { db } = await import("@/lib/db.server");
        const sql = db();

        // Identity
        const idRows = await sql<
          {
            current_database: string;
            current_user: string;
            server_version: string;
            inet_server_addr: string | null;
            inet_server_port: number | null;
            db_size_bytes: string;
            now: Date;
          }[]
        >`
          select current_database(),
                 current_user,
                 current_setting('server_version') as server_version,
                 inet_server_addr()::text as inet_server_addr,
                 inet_server_port() as inet_server_port,
                 pg_database_size(current_database())::text as db_size_bytes,
                 now()
        `;

        async function count(table: string): Promise<number | null> {
          try {
            const r = await sql.unsafe(`select count(*)::int as c from "${table}"`);
            return r[0].c as number;
          } catch {
            return null;
          }
        }

        const counts = {
          contacts: await count("contacts"),
          campaigns: await count("campaigns"),
          email_queue: await count("email_queue"),
          campaign_events: await count("campaign_events"),
          sns_event_log: await count("sns_event_log"),
          suppressed_emails: await count("suppressed_emails"),
          email_templates: await count("email_templates"),
          admin_users: await count("admin_users"),
        };

        // Parse the DSN host/port/db only (no password). Used to confirm runtime DSN
        // matches what ops thinks it deployed.
        let dsn: { host?: string; port?: string; database?: string; user?: string } = {};
        try {
          const u = new URL(process.env.DATABASE_URL || "");
          dsn = {
            host: u.hostname,
            port: u.port,
            database: u.pathname.replace(/^\//, ""),
            user: u.username,
          };
        } catch {
          /* ignore */
        }

        const body = {
          deployment: {
            app_url: process.env.APP_URL || null,
            request_host: new URL(request.url).host,
            now: new Date().toISOString(),
          },
          dsn_from_env: dsn,
          identity: idRows[0],
          counts,
        };

        return new Response(JSON.stringify(body, null, 2), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});
