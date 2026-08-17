import { api } from "./api";

export type DashboardMetrics = {
  total_contacts: number;
  total_lists: number;
  total_campaigns: number;
  draft_campaigns: number;
  scheduled_campaigns: number;
  sent_campaigns: number;
  sending_campaigns: number;
  emails_queued: number;
  emails_sent: number;
  emails_delivered: number;
  emails_opened: number;
  emails_clicked: number;
  failed_sends: number;
  bounces: number;
  complaints: number;
  unsubscribes: number;
  suppressed_emails: number;
  delivery_rate: number;
  open_rate: number;
  click_rate: number;
  bounce_rate: number;
  complaint_rate: number;
};

export type DashboardSummary = {
  metrics: DashboardMetrics;
  sending_activity: { day: string; sent: number; opened: number; clicked: number }[];
  recent_campaigns: {
    id: string;
    name: string;
    status: string;
    total_recipients: number;
    started_at: string | null;
    finished_at: string | null;
    created_at: string;
    opens: number;
    clicks: number;
    sent: number;
  }[];
  recent_events: {
    id: number;
    type: string;
    recipient: string | null;
    campaign: string | null;
    at: string;
  }[];
  queue_health: { pending: number; sending: number; sent: number; failed: number };
  recent_bounces: {
    id: number;
    recipient: string | null;
    campaign: string | null;
    type: string | null;
    at: string;
  }[];
  recent_complaints: {
    id: number;
    recipient: string | null;
    campaign: string | null;
    feedback_type: string | null;
    at: string;
  }[];
  top_campaigns: {
    id: string;
    name: string;
    sent: number;
    opens: number;
    clicks: number;
    open_rate: number;
    click_rate: number;
  }[];
  sns_health: {
    total: number;
    last_24h: number;
    last_event_at: string | null;
    last_event_type: string | null;
  };
  providers: {
    id: string;
    name: string;
    provider: string;
    region: string | null;
    status: string;
    last_checked_at: string | null;
    is_default: boolean;
  }[];
};

export const getDashboardSummary = () =>
  api<DashboardSummary>("/api/dashboard/summary");
