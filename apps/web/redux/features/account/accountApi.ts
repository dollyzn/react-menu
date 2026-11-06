import type { AccountSession, SessionUser } from "@react-menu/contracts";
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
  }),
});

export const {
  useGetSessionsQuery,
  useRevokeSessionMutation,
  useRevokeOtherSessionsMutation,
  useUpdateProfileMutation,
  useSetAvatarMutation,
  useRemoveAvatarMutation,
  useChangePasswordMutation,
} = accountApi;
