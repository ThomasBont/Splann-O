export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

type ApiMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type ApiRequestOptions = Omit<RequestInit, "method" | "body" | "headers" | "credentials"> & {
  method?: ApiMethod;
  body?: BodyInit | null | Record<string, unknown> | unknown[];
  headers?: HeadersInit;
  credentials?: RequestCredentials;
};

function isBodyInit(value: unknown): value is BodyInit {
  return value instanceof FormData
    || value instanceof URLSearchParams
    || value instanceof Blob
    || value instanceof ArrayBuffer
    || ArrayBuffer.isView(value)
    || typeof value === "string";
}

async function parseResponseBody(res: Response): Promise<unknown> {
  if (res.status === 204) return null;
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return res.json().catch(() => null);
  }
  return res.text().catch(() => "");
}

function getErrorMessage(statusText: string, data: unknown) {
  if (data && typeof data === "object" && "message" in data && typeof (data as { message?: unknown }).message === "string") {
    return (data as { message: string }).message;
  }
  if (typeof data === "string" && data.trim()) return data;
  return statusText || "Request failed";
}

export async function apiFetch(url: string, options: ApiRequestOptions = {}): Promise<Response> {
  const { method = "GET", body, headers, credentials = "include", ...rest } = options;
  const resolvedHeaders = new Headers(headers);

  let resolvedBody: BodyInit | undefined;
  if (body != null) {
    if (isBodyInit(body)) {
      resolvedBody = body;
    } else {
      resolvedHeaders.set("Content-Type", resolvedHeaders.get("Content-Type") ?? "application/json");
      resolvedBody = JSON.stringify(body);
    }
  }

  if (!resolvedHeaders.has("Accept")) {
    resolvedHeaders.set("Accept", "application/json");
  }

  return fetch(url, {
    method,
    body: resolvedBody,
    headers: resolvedHeaders,
    credentials,
    ...rest,
  });
}

export async function apiRequest<T = unknown>(url: string, options: ApiRequestOptions = {}): Promise<T> {
  const res = await apiFetch(url, options);
  const data = await parseResponseBody(res);
  if (!res.ok) {
    throw new ApiError(getErrorMessage(res.statusText, data), res.status, data);
  }
  return data as T;
}

export async function apiRequestOrNull<T = unknown>(url: string, options: ApiRequestOptions = {}): Promise<T | null> {
  const res = await apiFetch(url, options);
  if (res.status === 401) return null;
  const data = await parseResponseBody(res);
  if (!res.ok) {
    throw new ApiError(getErrorMessage(res.statusText, data), res.status, data);
  }
  return data as T;
}
