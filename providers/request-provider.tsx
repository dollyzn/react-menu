"use client";

import axios, { AxiosInstance, InternalAxiosRequestConfig } from "axios";

export const api: AxiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  withCredentials: true,
});

let logout: (() => void) | undefined;
export function injectLogout(_logout: (() => void) | undefined): void {
  logout = _logout;
}

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  config.headers = config.headers || {};
  config.headers["Access-Control-Allow-Origin"] = "*";

  if (!config.headers["Content-Type"]) {
    config.headers["Content-Type"] = "application/json";
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      switch (error.response.status) {
        case 422:
          error.code = "UNPROCESSABLE";
          break;

        case 403:
          error.code = "FORBIDDEN";
          break;

        case 404:
          error.code = "NOTFOUND";
          break;

        case 401:
          error.code = "UNAUTHORIZED";
          if (logout) logout();
          break;

        case 400:
          error.code = "BADREQUEST";
          break;

        default:
          console.error("Erro inesperado:", error);
          break;
      }
    }
    return Promise.reject(error);
  }
);
