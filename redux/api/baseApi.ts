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

const errorMessages: Record<string | number, string> = {
  401: "Sua sessão expirou",
  403: "Acesso negado",
  404: "Recurso não encontrado",
  500: "Ocorreu um erro interno no servidor",
  ECONNABORTED: "A requisição demorou demais a responder",
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
    return envelope.data;
  }

  return body;
}

const rawBaseQuery = fetchBaseQuery({
  baseUrl: getApiBaseUrl(),
  credentials: "include",
  timeout: env.NEXT_PUBLIC_API_TIMEOUT,
});

const baseQueryWithHandling: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  let result = await rawBaseQuery(args, api, extraOptions);

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

    if (status === 401) {
      api.dispatch(setIsSessionExpired(true));
    } else if (message) {
      toast.error(message);
    }
  }

  return result;
};

export const baseApi = createApi({
  reducerPath: "api",
  baseQuery: baseQueryWithHandling,
  tagTypes: ["Store", "Category", "Item", "Addon"],
  endpoints: () => ({}),
});

export type { FetchBaseQueryError };
