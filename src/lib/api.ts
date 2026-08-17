const TOKEN_KEY = "hsenations_mail_token";

export const getToken = () =>
  typeof window !== "undefined" ? window.localStorage.getItem(TOKEN_KEY) : null;

export const setToken = (token: string) => window.localStorage.setItem(TOKEN_KEY, token);

export const clearToken = () => window.localStorage.removeItem(TOKEN_KEY);

const API_URL =
  (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_API_URL?.trim()) ||
  "";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

type ApiOpts = Omit<RequestInit, "body"> & { body?: any; raw?: boolean };

export async function api<T = any>(path: string, opts: ApiOpts = {}): Promise<T> {
  const headers: Record<string, string> = {
    ...(opts.raw ? {} : { "Content-Type": "application/json" }),
    ...(opts.headers as Record<string, string>),
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, {
    ...opts,
    headers,
    body: opts.raw
      ? (opts.body as BodyInit)
      : opts.body !== undefined
        ? JSON.stringify(opts.body)
        : undefined,
  });

  if (res.status === 401) {
    clearToken();
    if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
      window.location.href = "/login";
    }
    throw new ApiError("Unauthorized", 401);
  }

  const ct = res.headers.get("content-type") || "";
  const data = ct.includes("application/json") ? await res.json() : await res.text();
  if (!res.ok) {
    const msg = typeof data === "object" ? data.error || "Request failed" : String(data);
    throw new ApiError(msg, res.status);
  }
  return data as T;
}

export const API_BASE = API_URL;
