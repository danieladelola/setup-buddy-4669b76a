import { createFileRoute } from "@tanstack/react-router";
import { requireAuth, json } from "@/lib/server-auth";

type ProviderRow = {
  id: string;
  name: string;
  provider: string;
  region: string | null;
  from_email: string | null;
  from_name: string | null;
  configuration_set: string | null;
  sns_topic_arn: string | null;
  is_default: boolean;
  status: string;
  last_checked_at: Date | null;
  last_error: string | null;
};

export const Route = createFileRoute("/api/deliverability/providers")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await requireAuth(request);
        if (auth instanceof Response) return auth;

        const { db } = await import("@/lib/db.server");
        const { getSesConfig } = await import("@/lib/ses.server");
        const sql = db();

        const rows = (await sql`
          SELECT id, name, provider, region, from_email, from_name,
            configuration_set, sns_topic_arn, is_default, status,
            last_checked_at, last_error
          FROM email_providers
          ORDER BY is_default DESC, name`) as ProviderRow[];

        const cfg = getSesConfig();
        const items: Array<ProviderRow & { source: "env" | "db" }> = rows.map((r) => ({
          ...r,
          source: "db" as const,
        }));

        // Synthesize a read-only env-backed SES provider so the page always shows
        // the active sending infra even before any db row is registered.
        const envProviderConfigured =
          !!cfg.region && (!!cfg.configurationSet || !!cfg.defaultFromEmail);
        const hasDbSesDefault = rows.some(
          (r) => r.provider === "ses" && r.is_default,
        );
        if (envProviderConfigured && !hasDbSesDefault) {
          items.unshift({
            id: "env:ses",
            name: "AWS SES (.env)",
            provider: "ses",
            region: cfg.region,
            from_email: cfg.defaultFromEmail,
            from_name: cfg.defaultFromName,
            configuration_set: cfg.configurationSet,
            sns_topic_arn: cfg.snsTopicArn,
            is_default: !rows.some((r) => r.is_default),
            status: cfg.healthy ? "healthy" : "unverified",
            last_checked_at: null,
            last_error: cfg.missing.length ? `Missing: ${cfg.missing.join(", ")}` : null,
            source: "env",
          });
        }

        return json({ items });
      },

      POST: async ({ request }) => {
        const auth = await requireAuth(request);
        if (auth instanceof Response) return auth;

        const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
        const name = String(body.name || "").trim();
        const provider = String(body.provider || "ses").trim();
        if (!name) return json({ error: "name is required" }, 400);

        const region = body.region ? String(body.region) : null;
        const from_email = body.from_email ? String(body.from_email) : null;
        const from_name = body.from_name ? String(body.from_name) : null;
        const configuration_set = body.configuration_set ? String(body.configuration_set) : null;
        const sns_topic_arn = body.sns_topic_arn ? String(body.sns_topic_arn) : null;
        const is_default = body.is_default === true;

        const { db } = await import("@/lib/db.server");
        const sql = db();

        const rows = await sql<ProviderRow[]>`
          INSERT INTO email_providers
            (name, provider, region, from_email, from_name, configuration_set, sns_topic_arn, is_default)
          VALUES (${name}, ${provider}, ${region}, ${from_email}, ${from_name},
                  ${configuration_set}, ${sns_topic_arn}, ${is_default})
          RETURNING *`;

        if (is_default && rows[0]) {
          await sql`UPDATE email_providers SET is_default = false WHERE id <> ${rows[0].id}`;
        }
        return json(rows[0]);
      },
    },
  },
});
