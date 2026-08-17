import { api, API_BASE, getToken } from "./api";

export type AnalyticsOverview = {
  range: { from: string; to: string };
  total_campaigns: number;
  suppressed_added: number;
  sent: number;
  delivered: number;
  opened: number;
  unique_opens: number;
  clicked: number;
  unique_clicks: number;
  bounced: number;
  complained: number;
  unsubscribed: number;
  failed: number;
  delivery_rate: number;
  open_rate: number;
  click_rate: number;
  bounce_rate: number;
  complaint_rate: number;
  unsubscribe_rate: number;
};

export type TrendPoint = {
  bucket: string;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  complained: number;
  unsubscribed: number;
};

export type CampaignPerformance = {
  id: string;
  name: string;
  status: string;
  from_email: string;
  from_name: string;
  total_recipients: number;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  sent: number;
  delivered: number;
  opens: number;
  unique_opens: number;
  clicks: number;
  unique_clicks: number;
  bounced: number;
  complained: number;
  unsubscribed: number;
  failed: number;
  delivery_rate: number;
  open_rate: number;
  click_rate: number;
  bounce_rate: number;
  complaint_rate: number;
};

export type TrackingEvent = {
  id: number;
  campaign_id: string;
  campaign_name: string | null;
  queue_id: string | null;
  event_type: "open" | "click";
  recipient_email: string | null;
  link_url: string | null;
  user_agent: string | null;
  ip_address: string | null;
  occurred_at: string;
};

export type BounceEvent = {
  id: number;
  campaign_id: string;
  campaign_name: string | null;
  recipient_email: string | null;
  bounce_type: string | null;
  bounce_subtype: string | null;
  reason: string | null;
  provider_message_id: string | null;
  occurred_at: string;
};

export type ComplaintEvent = {
  id: number;
  campaign_id: string;
  campaign_name: string | null;
  recipient_email: string | null;
  feedback_type: string | null;
  user_agent: string | null;
  provider_message_id: string | null;
  occurred_at: string;
};

export type TopLink = { url: string; clicks: number; unique_clicks: number };

const qs = (p: Record<string, string | undefined | null>) => {
  const params = new URLSearchParams();
  Object.entries(p).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") params.set(k, v);
  });
  const s = params.toString();
  return s ? `?${s}` : "";
};

export const getOverview = (p: { from?: string; to?: string; campaign_id?: string }) =>
  api<AnalyticsOverview>(`/api/analytics/overview${qs(p)}`);

export const getTrends = (p: {
  from?: string;
  to?: string;
  interval?: "day" | "hour";
  campaign_id?: string;
}) => api<{ interval: string; points: TrendPoint[] }>(`/api/analytics/trends${qs(p)}`);

export const getCampaignPerformance = (p: { from?: string; to?: string }) =>
  api<{ items: CampaignPerformance[] }>(`/api/analytics/campaigns${qs(p)}`).then(
    (r) => r.items,
  );

export const getTrackingEvents = (p: {
  from?: string;
  to?: string;
  type?: "open" | "click";
  campaign_id?: string;
  limit?: number;
}) =>
  api<{ items: TrackingEvent[] }>(
    `/api/analytics/tracking${qs({ ...p, limit: p.limit?.toString() })}`,
  ).then((r) => r.items);

export const getTopLinks = (p: { from?: string; to?: string; campaign_id?: string }) =>
  api<{ items: TopLink[] }>(`/api/analytics/top-links${qs(p)}`).then((r) => r.items);

export const getBounceEvents = (p: { from?: string; to?: string }) =>
  api<{ items: BounceEvent[] }>(`/api/analytics/bounces${qs(p)}`).then((r) => r.items);

export const getComplaintEvents = (p: { from?: string; to?: string }) =>
  api<{ items: ComplaintEvent[] }>(`/api/analytics/complaints${qs(p)}`).then(
    (r) => r.items,
  );

export const getEventRaw = (id: string | number) =>
  api<any>(`/api/analytics/events/${id}/raw`);

export const exportCsvUrl = (
  type: "campaigns" | "bounces" | "complaints",
  range: { from?: string; to?: string },
) => {
  const token = getToken();
  return `${API_BASE}/api/analytics/export${qs({ type, ...range })}${token ? `${qs({ token: "" }) ? "&" : ""}` : ""}`;
};

// CSV downloads need an auth header, so do it via fetch + blob.
export const downloadCsv = async (
  type: "campaigns" | "bounces" | "complaints",
  range: { from?: string; to?: string },
) => {
  const token = getToken();
  const res = await fetch(
    `${API_BASE}/api/analytics/export${qs({ type, ...range })}`,
    { headers: token ? { Authorization: `Bearer ${token}` } : {} },
  );
  if (!res.ok) throw new Error("Export failed");
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${type}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
};

export const addSuppression = (email: string, reason = "manual") =>
  api<{ ok: true }>(`/api/deliverability/suppression`, {
    method: "POST",
    body: { email, reason },
  });
