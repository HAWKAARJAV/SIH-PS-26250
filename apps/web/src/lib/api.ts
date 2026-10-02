export type Me = {
  id: string;
  email: string;
  role: string;
  display_name: string;
  csrf: string;
  demo_mode: boolean;
  idle_timeout_min: number;
};

let csrf = "";

export function setCsrf(value: string) {
  csrf = value;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (csrf && init.method && init.method !== "GET") headers.set("X-CSRF-Token", csrf);
  const response = await fetch(path, { ...init, headers, credentials: "include" });
  const data = (await response.json().catch(() => ({}))) as { message?: string };
  if (!response.ok) {
    throw new ApiError(data.message || "That didn't land. Nothing was changed. Try again.", response.status);
  }
  return data as T;
}
