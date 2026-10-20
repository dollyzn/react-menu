import type { ReactNode } from "react";
import type { SessionUser } from "@react-menu/contracts";

export type User = SessionUser;

export interface SessionContextType {
  isAuthenticated: boolean;
  user: User | null;
  login: (props: LoginProps) => Promise<void | string>;
  logout: () => Promise<void>;
  verify: () => Promise<User | null>;
}

export interface SessionProviderProps {
  children: ReactNode;
}

export interface LoginProps {
  email: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  data: {
    user?: User;
  };
  error?: string;
}
