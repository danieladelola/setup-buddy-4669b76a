import { api } from "./api";
import type { BuilderDoc } from "./email-builder/types";

export type TemplateStatus = "draft" | "active" | "archived";

export type Template = {
  id: string;
  name: string;
  subject: string;
  html_body: string;
  text_body: string | null;
  preview_text: string | null;
  from_name: string | null;
  status: TemplateStatus;
  tags: string[] | null;
  builder_json: BuilderDoc | null;
  created_at: string;
  updated_at: string;
};

export type TemplateInput = {
  name: string;
  subject?: string;
  html_body?: string;
  text_body?: string | null;
  preview_text?: string | null;
  from_name?: string | null;
  status?: TemplateStatus;
  tags?: string[];
  builder_json?: BuilderDoc | null;
};

export const listTemplates = () =>
  api<{ data: Template[] }>(`/api/templates`).then((r) => r.data);

export const getTemplate = (id: string) => api<Template>(`/api/templates/${id}`);

export const createTemplate = (input: TemplateInput) =>
  api<Template>(`/api/templates`, { method: "POST", body: input });

export const updateTemplate = (id: string, input: Partial<TemplateInput>) =>
  api<Template>(`/api/templates/${id}`, { method: "PUT", body: input });

export const deleteTemplate = (id: string) =>
  api<{ ok: true }>(`/api/templates/${id}`, { method: "DELETE" });

export const duplicateTemplate = (id: string) =>
  api<Template>(`/api/templates/${id}/duplicate`, { method: "POST" });

export const sendTestTemplate = (id: string, to: string) =>
  api<{ ok: true; messageId: string | null }>(
    `/api/templates/${id}/test-send`,
    { method: "POST", body: { to } },
  );
