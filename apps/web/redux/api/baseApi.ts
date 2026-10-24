import {
  createApi,
  fetchBaseQuery,
  FetchArgs,
  FetchBaseQueryError,
} from "@reduxjs/toolkit/query/react";
import type { BaseQueryFn } from "@reduxjs/toolkit/query";
import { setIsSessionExpired } from "@/redux/slices/auth";
import { toast } from "sonner";
import { getApiBaseUrl } from "@/lib/api-base-url";
import { env } from "@/lib/env";
import { IDEMPOTENCY_HEADER, randomId } from "@/lib/idempotency";
import { trackWrite } from "@/lib/pending-writes";

const errorMessages: Record<string | number, string> = {
  401: "Sua sessão expirou",
  403: "Acesso negado",
  404: "Recurso não encontrado",
  500: "Ocorreu um erro interno no servidor",
  ECONNABORTED: "A requisição demorou demais a responder",
  FETCH_ERROR: "Sem conexão com o servidor. Verifique a internet e tente de novo.",
  TIMEOUT_ERROR: "A conexão está lenta e o servidor não respondeu. Tente de novo.",
  ERR_NETWORK:
    "Não foi possível conectar ao servidor. Verifique sua conexão com a internet e tente novamente.",
  ERR_CANCELED: "",
};

/** Query params: `page` 1-based; `perPage` conforme API Lucid. */
export const buildParams = (
  baseParams: Record<string, unknown> = {},
  pagination?: { page?: number; pageSize?: number },
  sort?: string | string[]
) => {
  const params: Record<string, unknown> = { ...baseParams };
  if (pagination) {
    if (pagination.page !== undefined) params.page = pagination.page;
    if (pagination.pageSize !== undefined) params.perPage = pagination.pageSize;
  }
  if (sort !== undefined) params.sort = sort;
  return params;
};

function unwrapApiJson(body: unknown): unknown {
  if (!body || typeof body !== "object") return body;
  if (!("success" in body)) return body;

  const envelope = body as {
    success: boolean;
    data?: unknown;
    meta?: unknown;
    message?: string;
  };

  if (envelope.success === false) return body;

  if ("data" in envelope && envelope.data !== undefined) {
    const payload = envelope.data;
    if (
      envelope.meta !== undefined &&
      typeof envelope.meta === "object" &&
      Array.isArray(payload)
    ) {
      return { data: payload, meta: envelope.meta };
    }
    return payload;
  }

  return body;
}

const rawBaseQuery = fetchBaseQuery({
  baseUrl: getApiBaseUrl(),
  credentials: "include",
  timeout: env.NEXT_PUBLIC_API_TIMEOUT,
});

const RETRY_DELAYS_MS = [500, 1000, 2000, 4000, 8000];

/** Network failures and "try again" answers; never validation or auth errors. */
function isTransient(error: FetchBaseQueryError) {
  if (error.status === "FETCH_ERROR" || error.status === "TIMEOUT_ERROR") return true;
  if (error.status === 502 || error.status === 503 || error.status === 504) return true;
  const code = (error.data as { code?: string } | undefined)?.code;
  return error.status === 409 && code === "E_IDEMPOTENCY_IN_PROGRESS";
}

/** Waits for the delay, or longer while the device is offline (max 30s). */
function waitToRetry(delay: number, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    const jitter = delay * (0.75 + Math.random() * 0.5);
    let offlineTimer: ReturnType<typeof setTimeout> | undefined;
    const done = () => {
      clearTimeout(timer);
      clearTimeout(offlineTimer);
      window.removeEventListener("online", done);
      resolve();
    };
    const timer = setTimeout(() => {
      if (navigator.onLine) return done();
      window.addEventListener("online", done, { once: true });
      offlineTimer = setTimeout(done, 30_000);
    }, jitter);
    signal.addEventListener("abort", done, { once: true });
  });
}

/**
 * Every write carries an Idempotency-Key (fresh per call unless the endpoint
 * passes a stable one) and is retried with the same key on transient
 * failures, so a lost response never runs an operation twice. Reads are
 * retried too. Errors are shown only after the last attempt.
 */
async function withRetries(
  args: string | FetchArgs,
  api: Parameters<typeof rawBaseQuery>[1],
  extraOptions: Parameters<typeof rawBaseQuery>[2]
) {
  const request: FetchArgs = typeof args === "string" ? { url: args } : { ...args };
  const method = (request.method ?? "GET").toUpperCase();
  const isWrite = method !== "GET" && method !== "HEAD";

  if (isWrite) {
    const headers = new Headers(request.headers as HeadersInit | undefined);
    if (!headers.has(IDEMPOTENCY_HEADER)) headers.set(IDEMPOTENCY_HEADER, randomId());
    request.headers = headers;
  }

  const attempts = isWrite ? RETRY_DELAYS_MS.length : 2;
  let result = await rawBaseQuery(request, api, extraOptions);
  for (let attempt = 0; attempt < attempts && result.error && isTransient(result.error); attempt++) {
    if (api.signal.aborted) break;
    await waitToRetry(RETRY_DELAYS_MS[attempt], api.signal);
    result = await rawBaseQuery(request, api, extraOptions);
  }
  return result;
}

/** Per-endpoint options (`extraOptions` in an endpoint definition). */
type ExtraOptions = {
  /** A write the user doesn't wait for (mark as read, push registration): never holds navigation. */
  background?: boolean;
  /** The screen shows this endpoint's errors itself: no global toast. */
  quiet?: boolean;
  /** Session endpoints (login, me…): a 401 means "not signed in", not "session expired". */
  session?: boolean;
};

const isWriteRequest = (args: string | FetchArgs) =>
  typeof args !== "string" && !["GET", "HEAD"].includes((args.method ?? "GET").toUpperCase());

const baseQueryWithHandling: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError,
  ExtraOptions
> = async (args, api, extraOptions) => {
  const run = withRetries(args, api, {});
  let result = await (isWriteRequest(args) && !extraOptions?.background ? trackWrite(run) : run);

  if (result.data !== undefined) {
    result = {
      ...result,
      data: unwrapApiJson(result.data),
    };
  }

  if (result.error) {
    const status = result.error.status as number | string | undefined;
    const data = result.error.data as
      | { error?: string; message?: string }
      | undefined;
    const message =
      (typeof data?.message === "string" ? data.message : undefined) ||
      data?.error ||
      (status !== undefined && errorMessages[status]) ||
      "Erro na requisição";

    const url = typeof args === "string" ? args : args.url;
    if (status === 401) {
      // A customer link that stopped working is handled by the menu, not the staff session.
      if (!url.startsWith("public/") && !extraOptions?.session) api.dispatch(setIsSessionExpired(true));
    } else if (message && !extraOptions?.quiet) {
      toast.error(message);
    }
  }

  return result;
};

export const baseApi = createApi({
  reducerPath: "api",
  baseQuery: baseQueryWithHandling,
  tagTypes: ["Store", "Category", "Item", "Addon", "Notification", "Order", "Kitchen", "Ingredient", "PublicOrder", "Member", "OptionGroup"],
  endpoints: () => ({}),
});

export type { FetchBaseQueryError };
