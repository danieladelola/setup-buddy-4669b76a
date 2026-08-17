import { api } from "./api";

export type SettingsMap = {
  general: { workspace_name: string; timezone: string; support_email: string };
  sending: {
    max_send_rate_per_sec: number;
    max_retries: number;
    throttle_on_bounce_spike: boolean;
    bounce_spike_threshold_pct: number;
  };
  tracking: { open_tracking: boolean; click_tracking: boolean; tracking_domain: string };
  branding: { brand_color: string; logo_url: string; reply_to: string };
  safety: { max_daily_sends: number; max_per_campaign: number; require_double_optin: boolean };
  unsubscribe: { one_click: boolean; footer_text: string };
  email_provider: { provider: "ses" | "brevo" };
};

export type SettingsKey = keyof SettingsMap;

export const settingsApi = {
  load: () => api<{ settings: SettingsMap; defaults: SettingsMap }>(`/api/settings`),
  save: <K extends SettingsKey>(key: K, value: SettingsMap[K]) =>
    api<{ ok: true; key: K; value: SettingsMap[K] }>(`/api/settings`, {
      method: "PUT",
      body: { key, value },
    }),
};
