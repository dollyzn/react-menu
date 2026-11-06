import type { ReactNode } from "react";
import type { SessionUser, TwoFactorChallenge } from "@react-menu/contracts";

export type User = SessionUser;

export interface SessionContextType {
  isAuthenticated: boolean;
  user: User | null;
  /** Signed in (`{}`), the second step to go (`twoFactor`), or the error to show. */
  login: (props: LoginProps) => Promise<LoginOutcome>;
  /** The second step's code; signed in on success, otherwise the error to show. */
  completeTwoFactor: (input: TwoFactorInput) => Promise<{ error?: string; attemptsLeft?: number; expired?: boolean }>;
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

export type LoginOutcome = { error?: string; twoFactor?: TwoFactorChallenge };

export interface TwoFactorInput {
  code: string;
  /** A recovery code instead of the app's. */
  recovery?: boolean;
  /** "Confiar neste dispositivo por 30 dias". */
  remember?: boolean;
}
