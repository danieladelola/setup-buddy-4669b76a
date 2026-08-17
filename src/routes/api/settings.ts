import { createFileRoute } from "@tanstack/react-router";
import { requireAuth, json } from "@/lib/server-auth";

// app_settings is a generic JSONB key-value store. We use one row per section:
//   general, sending, tracking, branding, safety, unsubscribe
// Secrets are NEVER stored here — they remain in env vars.
const ALLOWED_KEYS = new Set([
  "general",
  "sending",
  "tracking",
  "branding",
  "safety",
  "unsubscribe",
  "email_provider",
]);

const DEFAULTS: Record<string, Record<string, unknown>> = {
  general: { workspace_name: "HSENations Mail", timezone: "Europe/Stockholm", support_email: "" },
  sending: { max_send_rate_per_sec: 14, max_retries: 3, throttle_on_bounce_spike: true, bounce_spike_threshold_pct: 5 },
  tracking: { open_tracking: true, click_tracking: true, tracking_domain: "" },
  branding: { brand_color: "#5b5bff", logo_url: "", reply_to: "" },
  safety: { max_daily_sends: 50000, max_per_campaign: 100000, require_double_optin: false },
  // AWS SES stays the default provider.
  email_provider: { provider: "ses" },
  unsubscribe: { one_click: true, footer_text: "You received this email because you opted in." },
};

export const Route = createFileRoute("/api/settings")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await requireAuth(request);
        if (auth instanceof Response) return auth;
        const { db } = await import("@/lib/db.server");
        const sql = db();
        const rows = await sql<{ key: string; value: any; updated_at: Date }[]>`
          SELECT key, value, updated_at FROM app_settings
          WHERE key = ANY(${Array.from(ALLOWED_KEYS)})`;
        const map: Record<string, any> = {};
        for (const k of ALLOWED_KEYS) map[k] = { ...DEFAULTS[k] };
        for (const r of rows) map[r.key] = { ...DEFAULTS[r.key], ...(r.value || {}) };
        return json({ settings: map, defaults: DEFAULTS });
      },
      PUT: async ({ request }) => {
        const auth = await requireAuth(request);
        if (auth instanceof Response) return auth;
        const body = await request.json().catch(() => null) as any;
        if (!body || typeof body !== "object") return json({ error: "invalid body" }, 400);
        const key = String(body.key || "");
        if (!ALLOWED_KEYS.has(key)) return json({ error: "invalid key" }, 400);
        const value = body.value;
        if (!value || typeof value !== "object" || Array.isArray(value)) {
          return json({ error: "value must be an object" }, 400);
        }
        // Strip anything that looks like a secret. Defense-in-depth.
        const SECRET_RE = /(password|secret|api[_-]?key|token|access[_-]?key)/i;
        for (const k of Object.keys(value)) {
          if (SECRET_RE.test(k)) delete value[k];
        }
        const { db } = await import("@/lib/db.server");
        const sql = db();
        await sql`INSERT INTO app_settings (key, value, updated_at)
                  VALUES (${key}, ${sql.json(value)}, now())
                  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`;
        return json({ ok: true, key, value });
      },
    },
  },
});
