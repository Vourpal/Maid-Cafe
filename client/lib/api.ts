const BASE = process.env.NEXT_PUBLIC_API_URL;

export function authHeaders(): HeadersInit {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`
  };
}

export function authHeadersNoContent(): HeadersInit {
  const token = localStorage.getItem("token");
  return {
    "Authorization": `Bearer ${token}`
  };
}

/** Standard API envelope: every route returns { success, data, error }. */
type Envelope<T> = {
  success: boolean;
  data: T | null;
  error: { code: string; message: string } | null;
};

export class ApiError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

/**
 * Fetch wrapper that unwraps the envelope and turns API errors into throwables
 * carrying the server's message, so callers can surface it directly in a toast
 * instead of showing a generic failure.
 */
export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const hasBody = init.body !== undefined;

  const res = await fetch(`${BASE}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      ...(hasBody ? authHeaders() : authHeadersNoContent()),
      ...(init.headers ?? {}),
    },
  });

  let json: Envelope<T> | null = null;
  try {
    json = await res.json();
  } catch {
    // Non-JSON response (proxy error page, empty 502, etc.)
  }

  if (!res.ok || json?.success === false) {
    throw new ApiError(
      json?.error?.code ?? "REQUEST_FAILED",
      json?.error?.message ?? `Request failed (${res.status})`,
      res.status,
    );
  }

  return (json?.data ?? null) as T;
}

/** Build a query string, dropping empty/undefined values. */
export function queryString(
  params: Record<string, string | number | boolean | null | undefined>,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

/**
 * Download a CSV export.
 *
 * A plain link cannot be used here: the export endpoints are admin-only and the
 * token lives in localStorage, so the Authorization header has to be attached
 * manually and the response turned into a blob download.
 */
export async function downloadCsv(path: string, fallbackName: string) {
  const res = await fetch(`${BASE}${path}`, {
    headers: authHeadersNoContent(),
    cache: "no-store",
  });

  if (!res.ok) {
    let message = `Export failed (${res.status})`;
    try {
      const json = await res.json();
      message = json?.error?.message ?? message;
    } catch {
      // Response was not JSON; keep the status-based message.
    }
    throw new ApiError("EXPORT_FAILED", message, res.status);
  }

  // Prefer the server's filename when the header is readable cross-origin.
  const disposition = res.headers.get("Content-Disposition");
  const match = disposition?.match(/filename="?([^";]+)"?/i);
  const filename = match?.[1] ?? fallbackName;

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  URL.revokeObjectURL(url);
}
