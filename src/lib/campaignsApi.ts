import { api } from "./api";

export type CampaignStatus =
  | "draft" | "scheduled" | "queued" | "sending" | "sent" | "failed" | "cancelled";

export type CampaignRow = {
  id: string;
  name: string;
  status: CampaignStatus;
  scheduled_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  total_recipients: number;
  from_email: string;
  from_name: string;
  reply_to: string | null;
  provider: "ses" | "brevo" | null;
  created_at: string;
};

export type Campaign = CampaignRow & {
  template_id: string | null;
  list_id: string | null;
  list_ids: string[];
  subject: string;
  html_body: string;
  text_body: string | null;
  updated_at: string;
};

export type CampaignInput = {
  name: string;
  template_id?: string;
  list_ids: string[];
  subject: string;
  html_body: string;
  text_body?: string;
  from_email: string;
  from_name: string;
  reply_to?: string | null;
  provider?: "ses" | "brevo" | null;
  scheduled_at?: string;
};

export type CampaignReport = {
  total: number;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  complained: number;
  failed: number;
  unsubscribed: number;
  delivery_rate: number;
  open_rate: number;
  click_rate: number;
  bounce_rate: number;
  complaint_rate: number;
};

export const listCampaigns = () =>
  api<{ data: CampaignRow[] }>(`/api/campaigns`).then((r) => r.data);

export const getCampaign = (id: string) => api<Campaign>(`/api/campaigns/${id}`);

export const createCampaign = (input: CampaignInput) =>
  api<Campaign>(`/api/campaigns`, { method: "POST", body: input });

export const updateCampaign = (id: string, input: Partial<CampaignInput>) =>
  api<Campaign>(`/api/campaigns/${id}`, { method: "PUT", body: input });

export const deleteCampaign = (id: string) =>
  api<{ ok: true }>(`/api/campaigns/${id}`, { method: "DELETE" });

export const sendCampaign = (id: string) =>
  api<{ ok: true; queued: number }>(`/api/campaigns/${id}/send`, { method: "POST" });

export const sendTestEmail = (id: string, email: string) =>
  api<{ ok: true; message_id: string }>(`/api/campaigns/${id}/test`, {
    method: "POST",
    body: { email },
  });

export const getCampaignReport = (id: string) =>
  api<CampaignReport>(`/api/campaigns/${id}/report`);