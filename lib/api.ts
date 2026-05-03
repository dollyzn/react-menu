import type { Pagination, RequestConfig, BaseResponse } from "@/types/request";
import { errorMessages } from "@/types/request";
import { setIsSessionExpired } from "@/redux/slices/auth";
import { toast } from "sonner";
import axios from "axios";
import { env } from "./env";

type ApiResponse<T> = BaseResponse & T;

const api = axios.create({
  baseURL: env.NEXT_PUBLIC_API_URL,
  timeout: env.NEXT_PUBLIC_API_TIMEOUT,
  withCredentials: true,
});

const buildParams = (
  baseParams: Record<string, any> = {},
  pagination?: Pagination,
  sort?: string | string[]
) => {
  const params = { ...baseParams };

  if (pagination) {
    if (pagination.page !== undefined) params.page = pagination.page + 1;
    if (pagination.pageSize !== undefined)
      params.per_page = pagination.pageSize;
  }

  if (sort) {
    params.sort = sort;
  }

  return params;
};

export const request = async <T>({
  method = "get",
  url,
  data,
  params,
  pagination,
  sort,
  successMessage,
  errorMessage,
  showErrorMessage,
  headers,
  dispatch,
}: RequestConfig): Promise<ApiResponse<T>> => {
  try {
    const response = await api.request<ApiResponse<T>>({
      method,
      url,
      data,
      params: buildParams(params, pagination, sort),
      headers,
    });

    const resData = response.data;

    if (!resData.success) {
      resData.error = resData.error || errorMessage || "Erro inesperado";
    } else if (successMessage) {
      toast.success(successMessage);
    }

    return resData;
  } catch (error) {
    let message = errorMessage || "Erro na requisição";
    let code: number | string = "";

    if (axios.isAxiosError(error)) {
      code = error.response?.status || error.code || "";
      message = error.response?.data?.error || errorMessages[code] || message;
    }

    if (code !== 401 && showErrorMessage) {
      toast.error(message);
    }

    if (code === 401 && dispatch) {
      dispatch(setIsSessionExpired(true));
    }

    return {
      success: false,
      error: message,
    } as ApiResponse<T>;
  }
};
