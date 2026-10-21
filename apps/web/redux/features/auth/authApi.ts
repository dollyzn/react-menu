import { baseApi } from "@/redux/api/baseApi";

/** Password reset (no session needed). */
export const authApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
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
