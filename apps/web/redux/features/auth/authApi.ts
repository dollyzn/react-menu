import type { SessionUser } from "@react-menu/contracts";
import { baseApi } from "@/redux/api/baseApi";

/** Session (login, me, logout) and password reset. The session provider drives these. */
export const authApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    /** Sets the httpOnly session cookie. Errors are shown by the login form. */
    login: build.mutation<{ user: SessionUser }, { email: string; password: string }>({
      query: (body) => ({ url: "auth/login", method: "POST", body }),
      extraOptions: { quiet: true, session: true },
    }),
    /** The signed-in user; also renews the session in its second half (cookie). */
    me: build.query<{ user: SessionUser }, void>({
      query: () => "auth/me",
      extraOptions: { quiet: true, session: true },
      keepUnusedDataFor: 0,
    }),
    logout: build.mutation<void, void>({
      query: () => ({ url: "auth/logout", method: "DELETE" }),
      extraOptions: { quiet: true, session: true, background: true },
    }),
    /** Where to send the browser to sign in with a social provider. */
    socialRedirect: build.query<{ url: string }, string>({
      query: (provider) => `auth/social/${provider}/redirect`,
      extraOptions: { quiet: true, session: true },
    }),
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

export const { useForgotPasswordMutation, useResetPasswordMutation } = authApi;
