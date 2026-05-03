import {
  createApi,
  fetchBaseQuery,
  FetchArgs,
  FetchBaseQueryError,
} from "@reduxjs/toolkit/query/react";
import type { BaseQueryFn } from "@reduxjs/toolkit/query";
import { setIsSessionExpired } from "@/redux/slices/auth";
import { toast } from "sonner";
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

/** Query params: `page` deve ser o índice 1-based esperado pela API (igual ao fluxo antigo com axios). */
export const buildParams = (
  baseParams: Record<string, unknown> = {},
  pagination?: { page?: number; pageSize?: number },
  sort?: string | string[]
) => {
  const params: Record<string, unknown> = { ...baseParams };
  if (pagination) {
    if (pagination.page !== undefined) params.page = pagination.page;
    if (pagination.pageSize !== undefined)
      params.per_page = pagination.pageSize;
  }
  if (sort !== undefined) params.sort = sort;
  return params;
};

const rawBaseQuery = fetchBaseQuery({
  baseUrl: env.NEXT_PUBLIC_API_URL.replace(/\/?$/, "/"),
  credentials: "include",
  timeout: env.NEXT_PUBLIC_API_TIMEOUT,
});

const baseQueryWithHandling: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  const result = await rawBaseQuery(args, api, extraOptions);

  if (result.error) {
    const status = result.error.status as number | string | undefined;
    const data = result.error.data as { error?: string } | undefined;
    const message =
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
