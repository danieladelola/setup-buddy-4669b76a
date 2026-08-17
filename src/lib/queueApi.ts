import { api } from "./api";

export type QueueStatus = "pending" | "sending" | "sent" | "failed" | "skipped" | "cancelled";

export type QueueRow = {
  id: string;
  campaign_id: string;
  campaign_name: string | null;
  recipient_email: string;
  status: QueueStatus;
  attempts: number;
  last_error: string | null;
  ses_message_id: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
};

export type QueueListResponse = {
  rows: QueueRow[];
  total: number;
  limit: number;
  offset: number;
  metrics: Record<QueueStatus, number>;
  last_processed_at: string | null;
};

export type QueueFilters = {
  status?: string;
  campaign_id?: string;
  q?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
};

export const queueApi = {
  list: (f: QueueFilters = {}) => {
    const p = new URLSearchParams();
    Object.entries(f).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") p.set(k, String(v));
    });
    return api<QueueListResponse>(`/api/queue?${p.toString()}`);
  },
  get: (id: string) =>
    api<{ row: QueueRow & Record<string, any>; events: any[] }>(`/api/queue/${id}`),
  process: (batch = 50) =>
    api<{ ok: true; claimed: number; sent: number; failed: number; skipped: number }>(
      `/api/queue/process?batch=${batch}`,
      { method: "POST" },
    ),
  retryFailed: (campaignId?: string) =>
    api<{ ok: true; retried: number }>(`/api/queue/retry-failed`, {
      method: "POST",
      body: { campaign_id: campaignId },
    }),
  retrySelected: (ids: string[]) =>
    api<{ ok: true; retried: number }>(`/api/queue/retry-selected`, {
      method: "POST",
      body: { ids },
    }),
  cancelSelected: (ids: string[]) =>
    api<{ ok: true; cancelled: number }>(`/api/queue/cancel-selected`, {
      method: "POST",
      body: { ids },
    }),
};
