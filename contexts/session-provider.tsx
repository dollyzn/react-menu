"use client";

import type {
  LoginProps,
  LoginResponse,
  SessionContextType,
  SessionProviderProps,
} from "@/types/session";
import { RequestError } from "@/types/request";

import { createContext, useCallback, useContext, useRef } from "react";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import useDebouncedEffect from "@/hooks/use-debonced-effect";

import {
  setIsAuthenticated,
  setIsSessionExpired,
  setUser,
} from "@/redux/slices/auth";

import {
  differenceInMilliseconds,
  isEqual,
  isAfter,
  parseISO,
  setDefaultOptions,
} from "date-fns";
import { persistor } from "./redux-provider";
import { request } from "@/lib/api";
import { ptBR } from "date-fns/locale";
import { useNotification } from "./notification-provider";
import { clearSessionCookie } from "@/app/app/(auth)/actions";

export interface LoginError {
  message: string;
  invalidCredentials: boolean;
}

const SessionContext = createContext<SessionContextType | null>(null);

export function SessionProvider({ children }: SessionProviderProps) {
  const dispatch = useAppDispatch();
  const { unsubscribe } = useNotification();

  const user = useAppSelector((state) => state.auth.user);
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);

  useDebouncedEffect(() => {
    setDefaultOptions({ locale: ptBR });
  }, []);

  const ref = useRef<NodeJS.Timeout | null>(null);

  const expireSession = useCallback(() => {
    dispatch(setIsSessionExpired(true));
    if (ref.current) clearTimeout(ref.current);
  }, [dispatch]);

  function checkTokenExpiration() {
    if (!user?.tokenExpiresAt) return;

    const expirationTime = parseISO(user.tokenExpiresAt);
    const currentTime = new Date();

    if (
      isEqual(currentTime, expirationTime) ||
      isAfter(currentTime, expirationTime)
    ) {
      expireSession();
      return;
    }

    if (ref.current) clearTimeout(ref.current);
    const timeUntilExpiration = differenceInMilliseconds(
      expirationTime,
      currentTime
    );
    ref.current = setTimeout(
      checkTokenExpiration,
      Math.max(timeUntilExpiration, 0)
    );
  }

  useDebouncedEffect(() => {
    if (user) checkTokenExpiration();
  }, [user?.tokenExpiresAt]);

  const login = useCallback(
    async ({ email, password }: LoginProps) => {
      try {
        const response = await request<LoginResponse>({
          url: "auth/login",
          method: "post",
          data: { email, password },
        });

        if (!response.success)
          throw new RequestError(response.error || "Erro desconhecido");

        const data = response.data.user;

        if (!data) throw new RequestError("Erro ao realizar login");

        dispatch(setIsSessionExpired(false));
        dispatch(setUser(data));
      } catch (error) {
        return error instanceof RequestError
          ? error.message
          : "Não foi possível efetuar o login. Por favor, tente novamente mais tarde.";
      }
    },
    [dispatch]
  );

  async function logout() {
    if (user) {
      try {
        await clearSessionCookie();
        await unsubscribe();
        await request({
          url: "auth/logout",
          method: "delete",
        });
      } catch (error) {
        console.error("Logout failed", error);
      }
    }
    dispatch(setUser(null));
    persistor.purge();
  }

  const verify = useCallback(async () => {
    let attempts = 0;
    const maxRetries = 3;

    while (attempts < maxRetries) {
      try {
        const response = await request<LoginResponse>({
          url: "auth/me",
        });

        if (
          isAuthenticated &&
          response.error ===
            "Não foi possível conectar ao servidor. Verifique sua conexão com a internet e tente novamente."
        ) {
          attempts++;

          if (attempts >= maxRetries) {
            dispatch(setIsSessionExpired(true));
            dispatch(setIsAuthenticated(false));
            return null;
          }

          await new Promise((resolve) => setTimeout(resolve, 10000));
          continue;
        }

        if (!response.success || !response?.data?.user) {
          dispatch(setIsSessionExpired(true));
          return null;
        }

        dispatch(setIsSessionExpired(false));
        dispatch(setUser(response.data.user));
        return response.data.user;
      } catch {
        dispatch(setIsSessionExpired(true));
        return null;
      }
    }

    return null;
  }, [dispatch, isAuthenticated]);

  useDebouncedEffect(() => {
    verify();
  }, [verify]);

  return (
    <SessionContext.Provider
      value={{ isAuthenticated, user, login, logout, verify }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);

  if (!context) {
    throw new Error("useSession must be used within an SessionProvider");
  }

  return context;
}
