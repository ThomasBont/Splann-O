import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { apiFetch, ApiError } from "@/lib/api";

// Browser data access goes through our own /api routes with session auth.
// Do not introduce direct browser-side database/Supabase reads for normal app
// data unless they are intentionally protected by an anon key + RLS.

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn = <T,>(options: {
  on401: UnauthorizedBehavior;
}): QueryFunction<T> =>
  async ({ queryKey }) => {
    const unauthorizedBehavior = options.on401;
    const res = await apiFetch(queryKey.join("/") as string);
    const data = await (async () => {
      const contentType = res.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) return res.json().catch(() => null);
      return res.text().catch(() => "");
    })();

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null as T;
    }

    if (!res.ok) {
      const message = data && typeof data === "object" && "message" in data && typeof (data as { message?: unknown }).message === "string"
        ? (data as { message: string }).message
        : (typeof data === "string" && data) || res.statusText;
      throw new ApiError(message || "Request failed", res.status, data);
    }
    return data as T;
  };

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await apiFetch(url, {
    method: method as "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
    body: data as Record<string, unknown> | unknown[] | undefined,
  });
  const contentType = res.headers.get("content-type") ?? "";
  const parsed = contentType.includes("application/json")
    ? await res.json().catch(() => null)
    : await res.text().catch(() => "");
  if (!res.ok) {
    const message = parsed && typeof parsed === "object" && "message" in parsed && typeof (parsed as { message?: unknown }).message === "string"
      ? (parsed as { message: string }).message
      : (typeof parsed === "string" && parsed) || res.statusText;
    throw new ApiError(message || "Request failed", res.status, parsed);
  }
  return new Response(
    parsed == null
      ? null
      : typeof parsed === "string"
        ? parsed
        : JSON.stringify(parsed),
    {
      status: res.status,
      statusText: res.statusText,
      headers: res.headers,
    },
  );
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
