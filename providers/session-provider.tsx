"use client";

import { createContext, useContext, ReactNode, useEffect } from "react";
import { encode, decode } from "../lib/jwt";
import { setCookie, removeCookie, getCookie } from "../lib/cookie";
import { usePathname, useRouter } from "next/navigation";
import { api, injectLogout } from "./request-provider";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "@/redux/store";
import { setUser } from "@/redux/slices/auth";
import isEqual from "lodash/isEqual";
import { persistor } from "./redux-provider";
import { redirectToLogin } from "@/utils/navigation";

export interface LoginError {
  message: string;
  invalidCredentials: boolean;
}
interface SessionContextData {
  user: User | null;
  login: ({
    email,
    password,
    redirectToApp,
  }: {
    email: string;
    password: string;
    redirectToApp?: boolean;
  }) => Promise<void>;
  logout: () => Promise<void>;
  verify: ({
    redirectToApp,
    redirectToLogin,
  }: {
    redirectToApp?: boolean;
    redirectToLogin?: boolean;
  }) => Promise<boolean>;
}

const SessionContext = createContext<SessionContextData>(
  {} as SessionContextData
);

interface SessionProviderProps {
  children: ReactNode;
}

const publicRoutes = ["/auth/login", "/"];

export function SessionProvider({ children }: SessionProviderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const dispatch = useDispatch<AppDispatch>();

  const user = useSelector((state: RootState) => state.auth.user);

  useEffect(() => {
    verify({ redirectToLogin: true });
  }, []);

  async function login({
    email,
    password,
    redirectToApp,
  }: {
    email: string;
    password: string;
    redirectToApp?: boolean;
  }): Promise<void> {
    try {
      const response = await api.post<User>("/auth/login", {
        email,
        password,
      });

      const data = response.data;
      const token = encode(data);

      if (!data || !token) throw new Error("Login failed");

      setCookie(token);
      dispatch(setUser(data));

      if (redirectToApp) {
        if (data.stores && data.stores.length > 0) {
          router.push(`/manage/${data.stores[0].id}`);
        } else {
          router.push("/manage");
        }
      }
    } catch (error: any) {
      const isCredentialsInvalid =
        error.response?.data?.message === "Invalid user credentials";
      throw error.response
        ? { ...error.response.data, invalidCredentials: isCredentialsInvalid }
        : new Error("Login failed");
    }
  }

  async function logout() {
    if (user) {
      try {
        await api.delete("/auth/logout");
      } catch (error: any) {
        console.error("Logout failed", error);
      }
    }
    removeCookie();
    dispatch(setUser(null));
    persistor.purge();
  }

  injectLogout(logout);

  async function verify({
    redirectToApp = false,
    redirectToLogin = false,
  }: {
    redirectToApp?: boolean;
    redirectToLogin?: boolean;
  }): Promise<boolean> {
    const token = getCookie();
    if (token) {
      const decodedUser = decode(token);
      if (decodedUser) {
        try {
          const response = await api.get<User>("/auth/me");

          if (response.data && !isEqual(response.data, decodedUser)) {
            removeCookie();
            dispatch(setUser(null));
            if (redirectToLogin) redirect();
            return false;
          }

          if (redirectToApp) {
            if (response.data.stores && response.data.stores.length > 0) {
              router.push(`/manage/${response.data.stores[0].id}`);
            } else {
              router.push("/manage");
            }
          }
        } catch (error) {
          removeCookie();
          dispatch(setUser(null));
          if (redirectToLogin) redirect();
          return false;
        }
      } else {
        if (redirectToLogin) redirect();
        return false;
      }
    } else {
      return false;
    }
    return true;
  }

  function redirect() {
    if (!publicRoutes.includes(pathname)) redirectToLogin(router);
  }

  return (
    <SessionContext.Provider value={{ user, login, logout, verify }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  return useContext(SessionContext);
}
