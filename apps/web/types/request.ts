import type { PaginationMeta } from "@react-menu/contracts";
import type { AppDispatch } from "@/redux/store";
import type { AxiosRequestConfig } from "axios";

type RequestMethod = "get" | "post" | "put" | "delete";

export interface Pagination {
  page?: number;
  pageSize?: number;
}

export type Meta = PaginationMeta;

export interface RequestConfig extends AxiosRequestConfig {
  method?: RequestMethod;
  pagination?: Pagination;
  sort?: string | string[];
  successMessage?: string;
  errorMessage?: string;
  showErrorMessage?: boolean;
  dispatch?: AppDispatch;
}

export interface BaseResponse {
  success: boolean;
  error?: string;
}

export const errorMessages: Record<string, string> = {
  401: "Sua sessão expirou",
  403: "Acesso negado",
  404: "Recurso não encontrado",
  500: "Ocorreu um erro interno no servidor",
  ECONNABORTED: "A requisição demorou demais a responder",
  ERR_NETWORK:
    "Não foi possível conectar ao servidor. Verifique sua conexão com a internet e tente novamente.",
  ERR_CANCELED: "",
};

export class RequestError extends Error {
  protected code: number;

  constructor(message: string, code: number = 400) {
    super(message);
    this.name = "ApiError";
    this.code = code;
  }
}

export type { BulkDeleteResult } from "@react-menu/contracts";
