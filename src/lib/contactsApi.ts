import { api, API_BASE, getToken } from "@/lib/api";

export type ContactList = { id: string; name: string };
export type Contact = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  company: string | null;
  job_title: string | null;
  award_category: string | null;
  status: string;
  source: string | null;
  notes: string | null;
  unsubscribed: boolean;
  created_at: string;
  updated_at: string;
  lists: ContactList[];
};

export type ContactInput = {
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  company?: string;
  job_title?: string;
  award_category?: string;
  status?: "subscribed" | "unsubscribed" | "bounced" | "complained";
  source?: string;
  notes?: string;
  list_ids?: string[];
};

export const listContacts = (params: {
  q?: string;
  status?: string;
  list_id?: string;
  limit?: number;
  offset?: number;
}) => {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== "" && v !== "all") qs.set(k, String(v));
  });
  return api<{ data: Contact[]; total: number; limit: number; offset: number }>(
    `/api/contacts?${qs.toString()}`,
  );
};

export const createContact = (body: ContactInput) =>
  api<Contact>("/api/contacts", { method: "POST", body });

export const updateContact = (id: string, body: Partial<ContactInput>) =>
  api<Contact>(`/api/contacts/${id}`, { method: "PUT", body });

export const deleteContact = (id: string) =>
  api(`/api/contacts/${id}`, { method: "DELETE" });

export const bulkDeleteContacts = (ids: string[]) =>
  api("/api/contacts/bulk-delete", { method: "POST", body: { ids } });

export const importContacts = async (file: File, list_id?: string) => {
  const fd = new FormData();
  fd.append("file", file);
  if (list_id) fd.append("list_id", list_id);
  return api<{ total: number; inserted: number; updated: number; duplicates: number; invalid: number }>(
    "/api/contacts/import",
    { method: "POST", body: fd, raw: true },
  );
};

export const exportContactsUrl = (params: { q?: string; list_id?: string } = {}) => {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => v && qs.set(k, String(v)));
  return `${API_BASE}/api/contacts/export.csv?${qs.toString()}`;
};

export const downloadCsv = async (url: string, filename: string) => {
  const token = getToken();
  const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new Error("Export failed");
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
};

// Lists
export type ListRow = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  member_count: number;
};
export type ListMember = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  award_category: string | null;
  added_at: string;
};

export const listLists = (q?: string) => {
  const qs = q ? `?q=${encodeURIComponent(q)}` : "";
  return api<{ data: ListRow[] }>(`/api/lists${qs}`);
};
export const createList = (body: { name: string; description?: string }) =>
  api<ListRow>("/api/lists", { method: "POST", body });
export const updateList = (id: string, body: { name?: string; description?: string | null }) =>
  api<ListRow>(`/api/lists/${id}`, { method: "PUT", body });
export const deleteList = (id: string) =>
  api(`/api/lists/${id}`, { method: "DELETE" });
export const listMembers = (id: string) =>
  api<{ data: ListMember[] }>(`/api/lists/${id}/members`);
export const addMembers = (id: string, contact_ids: string[]) =>
  api(`/api/lists/${id}/members`, { method: "POST", body: { contact_ids } });
export const removeMember = (listId: string, contactId: string) =>
  api(`/api/lists/${listId}/members/${contactId}`, { method: "DELETE" });
export const listExportUrl = (id: string) => `${API_BASE}/api/lists/${id}/export.csv`;

export type ImportResult = {
  total: number;
  inserted: number;
  updated: number;
  invalid: number;
  duplicates: number;
  linked: number;
};

export const importIntoList = (listId: string, rows: Array<Record<string, string>>) =>
  api<ImportResult>(`/api/lists/${listId}/import`, { method: "POST", body: { rows } });
