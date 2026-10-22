"use client";

import type { LoginProps, SessionContextType, SessionProviderProps } from "@/types/session";

import { createContext, useCallback, useContext, useRef } from "react";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import useDebouncedEffect from "@/hooks/use-debonced-effect";

import { setIsSessionExpired, setUser } from "@/redux/slices/auth";

import {
  differenceInMilliseconds,
  isEqual,
  isAfter,
  parseISO,
  setDefaultOptions,
} from "date-fns";
import { persistor } from "./redux-provider";
import { authApi } from "@/redux/features/auth/authApi";
import { getErrorMessage } from "@/utils/get-error-message";
import { ptBR } from "date-fns/locale";
import { useNotification } from "./notification-provider";
import { clearSessionCookie } from "@/app/app/(auth)/actions";
import { closeTransmit } from "@/lib/transmit";

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
        const { user } = await dispatch(authApi.endpoints.login.initiate({ email, password })).unwrap();
        dispatch(setIsSessionExpired(false));
        dispatch(setUser(user));
      } catch (error) {
        return getErrorMessage(
          error as { data?: { error?: string } },
          "Não foi possível efetuar o login. Por favor, tente novamente mais tarde."
        );
      }
    },
    [dispatch]
  );

  async function logout() {
    if (user) {
      try {
        await unsubscribe();
        await dispatch(authApi.endpoints.logout.initiate()).unwrap();
      } catch (error) {
        // 401: the session had already ended (expired, signed out elsewhere,
        // APP_KEY changed). Either way the local sign-out below goes on.
        if ((error as { status?: unknown }).status !== 401) console.warn("Logout request failed", error);
      }
    }
    await clearSessionCookie().catch(() => undefined);
    closeTransmit();
    dispatch(setUser(null));
    persistor.purge();
  }

  /** Loads the session (and renews it when it is past half its life). */
  const verify = useCallback(async () => {
    try {
      const { user } = await dispatch(
        authApi.endpoints.me.initiate(undefined, { forceRefetch: true, subscribe: false })
      ).unwrap();
      dispatch(setIsSessionExpired(false));
      dispatch(setUser(user));
      return user;
    } catch (error) {
      // Only a 401 means the session is gone. Rate limiting, server errors
      // and being offline are transient (baseApi already retried): keep the
      // current session state.
      if ((error as { status?: unknown }).status === 401 && isAuthenticated) {
        dispatch(setIsSessionExpired(true));
      }
      return null;
    }
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
