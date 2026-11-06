import type { AccountSession, SessionUser, TwoFactorStatus } from "@react-menu/contracts";
import { baseApi } from "@/redux/api/baseApi";
import { setUser } from "@/redux/slices/auth";

/** Writes that answer with the updated user put it in the session right away. */
const updatesSessionUser = {
  async onQueryStarted(_arg: unknown, { dispatch, queryFulfilled }: { dispatch: (action: unknown) => unknown; queryFulfilled: Promise<{ data: SessionUser }> }) {
    try {
      const { data } = await queryFulfilled;
      dispatch(setUser(data));
    } catch {
      // The form shows the error.
    }
  },
};

/** The signed-in user's own account: sessions, profile, photo and password. */
export const accountApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getSessions: build.query<AccountSession[], void>({
      query: () => "account/sessions",
      providesTags: [{ type: "AccountSession", id: "LIST" }],
    }),
    revokeSession: build.mutation<void, number>({
      query: (id) => ({ url: `account/sessions/${id}`, method: "DELETE" }),
      invalidatesTags: [{ type: "AccountSession", id: "LIST" }],
    }),
    revokeOtherSessions: build.mutation<void, void>({
      query: () => ({ url: "account/sessions", method: "DELETE" }),
      invalidatesTags: [{ type: "AccountSession", id: "LIST" }],
    }),
    updateProfile: build.mutation<SessionUser, { name: string }>({
      query: (body) => ({ url: "account/profile", method: "PUT", body }),
      extraOptions: { quiet: true },
      ...updatesSessionUser,
    }),
    setAvatar: build.mutation<SessionUser, Blob>({
      query: (avatar) => {
        const body = new FormData();
        body.append("avatar", avatar, `avatar.${avatar.type === "image/webp" ? "webp" : "jpg"}`);
        return { url: "account/avatar", method: "PUT", body };
      },
      extraOptions: { quiet: true },
      ...updatesSessionUser,
    }),
    removeAvatar: build.mutation<SessionUser, void>({
      query: () => ({ url: "account/avatar", method: "DELETE" }),
      extraOptions: { quiet: true },
      ...updatesSessionUser,
    }),
    /** Ends the other sessions too (the list refreshes). */
    changePassword: build.mutation<void, { currentPassword: string; password: string; passwordConfirmation: string }>({
      query: (body) => ({ url: "account/password", method: "PUT", body }),
      extraOptions: { quiet: true },
      invalidatesTags: [{ type: "AccountSession", id: "LIST" }],
    }),
    twoFactorStatus: build.query<TwoFactorStatus, void>({
      query: () => "account/two-factor",
      providesTags: ["TwoFactor"],
    }),
    /** A new secret to scan; nothing changes until `enableTwoFactor` gets a code from it. */
    /** Needs the password: a session alone can't tie the account to another phone. */
    setupTwoFactor: build.mutation<{ secret: string; uri: string }, { password: string }>({
      query: (body) => ({ url: "account/two-factor/setup", method: "POST", body }),
      extraOptions: { quiet: true },
    }),
    /** Returns the recovery codes (shown once). */
    enableTwoFactor: build.mutation<{ recoveryCodes: string[] }, { code: string }>({
      query: (body) => ({ url: "account/two-factor/enable", method: "POST", body }),
      extraOptions: { quiet: true },
      invalidatesTags: ["TwoFactor", { type: "AccountSession", id: "LIST" }],
    }),
    disableTwoFactor: build.mutation<void, { password: string }>({
      query: (body) => ({ url: "account/two-factor/disable", method: "POST", body }),
      extraOptions: { quiet: true },
      invalidatesTags: ["TwoFactor", { type: "AccountSession", id: "LIST" }],
    }),
    regenerateRecoveryCodes: build.mutation<{ recoveryCodes: string[] }, { code: string }>({
      query: (body) => ({ url: "account/two-factor/recovery-codes", method: "POST", body }),
      extraOptions: { quiet: true },
      invalidatesTags: ["TwoFactor"],
    }),
  }),
});

export const {
  useTwoFactorStatusQuery,
  useSetupTwoFactorMutation,
  useEnableTwoFactorMutation,
  useDisableTwoFactorMutation,
  useRegenerateRecoveryCodesMutation,
  useGetSessionsQuery,
  useRevokeSessionMutation,
  useRevokeOtherSessionsMutation,
  useUpdateProfileMutation,
  useSetAvatarMutation,
  useRemoveAvatarMutation,
  useChangePasswordMutation,
} = accountApi;
