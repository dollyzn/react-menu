import type { LoginResult, SessionUser, SocialProvider, TwoFactorChallenge } from "@react-menu/contracts";
import { baseApi } from "@/redux/api/baseApi";

/** Session (login, me, logout) and password reset. The session provider drives these. */
export const authApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    /** Sets the httpOnly session cookie. Errors are shown by the login form. */
    /** Signed in, or the second step to go (its cookie is set). */
    login: build.mutation<LoginResult, { email: string; password: string }>({
      query: (body) => ({ url: "auth/login", method: "POST", body }),
      extraOptions: { quiet: true, session: true },
    }),
    /** The pending second step of this browser (after "Entrar com Google"). */
    twoFactorChallenge: build.query<{ twoFactor: TwoFactorChallenge }, void>({
      query: () => "auth/two-factor",
      extraOptions: { quiet: true, session: true },
      keepUnusedDataFor: 0,
    }),
    verifyTwoFactor: build.mutation<{ user: SessionUser }, { code: string; recovery?: boolean; remember?: boolean }>({
      query: (body) => ({ url: "auth/two-factor", method: "POST", body }),
      extraOptions: { quiet: true, session: true },
    }),
    resendTwoFactor: build.mutation<{ twoFactor: TwoFactorChallenge }, void>({
      query: () => ({ url: "auth/two-factor/resend", method: "POST" }),
      extraOptions: { quiet: true, session: true },
    }),
    /** The signed-in user; also renews the session in its second half (cookie). */
    me: build.query<{ user: SessionUser }, void>({
      query: () => "auth/me",
      extraOptions: { quiet: true, session: true },
      keepUnusedDataFor: 0,
    }),
    /**
     * The panel's heartbeat ("online" on the team page). A 401 here signs the
     * tab out like any other request (e.g. a manager switched access off).
     */
    presence: build.query<void, void>({
      query: () => "auth/presence",
      extraOptions: { quiet: true },
      keepUnusedDataFor: 0,
    }),
    logout: build.mutation<void, void>({
      query: () => ({ url: "auth/logout", method: "DELETE" }),
      extraOptions: { quiet: true, session: true, background: true },
    }),
    /** Social providers configured on the server (the login page shows their buttons). */
    socialProviders: build.query<{ providers: SocialProvider[] }, void>({
      query: () => "auth/social/providers",
      extraOptions: { quiet: true, session: true },
    }),
    /** Where to send the browser to sign in with a social provider. */
    forgotPassword: build.mutation<void, { email: string }>({
      query: (body) => ({ url: "auth/forgot-password", method: "POST", body }),
    }),
    resetPassword: build.mutation<void, { token: string; password: string }>({
      query: (body) => ({ url: "auth/reset-password", method: "POST", body }),
      // The page shows the invalid-link message itself.
      extraOptions: { quiet: true },
    }),
  }),
});

export const {
  useForgotPasswordMutation,
  useResetPasswordMutation,
  useSocialProvidersQuery,
  useResendTwoFactorMutation,
  useLazyTwoFactorChallengeQuery,
  useTwoFactorChallengeQuery,
  useLazyPresenceQuery,
} = authApi;
