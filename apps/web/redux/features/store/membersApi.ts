import type { StoreMember, StoreRole } from "@react-menu/contracts";
import { baseApi } from "@/redux/api/baseApi";

const tag = (storeId: string) => ({ type: "Member" as const, id: storeId });

/** The store's team (managers only). */
export const membersApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getMembers: build.query<StoreMember[], string>({
      query: (storeId) => `stores/${storeId}/members`,
      providesTags: (_res, _err, storeId) => [tag(storeId)],
    }),
    addMember: build.mutation<
      StoreMember & { invited: boolean },
      { storeId: string; data: { email: string; name?: string; role: StoreRole } }
    >({
      query: ({ storeId, data }) => ({ url: `stores/${storeId}/members`, method: "POST", body: data }),
      invalidatesTags: (_res, _err, { storeId }) => [tag(storeId)],
    }),
    updateMemberRole: build.mutation<StoreMember, { storeId: string; userId: string; role: StoreRole }>({
      query: ({ storeId, userId, role }) => ({
        url: `stores/${storeId}/members/${userId}`,
        method: "PUT",
        body: { role },
      }),
      invalidatesTags: (_res, _err, { storeId }) => [tag(storeId)],
    }),
    removeMember: build.mutation<void, { storeId: string; userId: string }>({
      query: ({ storeId, userId }) => ({ url: `stores/${storeId}/members/${userId}`, method: "DELETE" }),
      invalidatesTags: (_res, _err, { storeId }) => [tag(storeId)],
    }),
  }),
});

export const {
  useGetMembersQuery,
  useAddMemberMutation,
  useUpdateMemberRoleMutation,
  useRemoveMemberMutation,
} = membersApi;
