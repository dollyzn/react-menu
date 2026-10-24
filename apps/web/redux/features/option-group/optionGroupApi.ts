import type { OptionGroup } from "@react-menu/contracts";
import { baseApi } from "@/redux/api/baseApi";
import { buildStoreListUrl, type StoreScopedListArg } from "@/redux/api/listQueryParams";
import type { PaginatedList } from "@/types/paginated-list";

export type OptionGroupInput = {
  name: string;
  minChoices: number;
  maxChoices: number;
  /** The options (store add-ons), in display order. */
  addonIds: string[];
};

const tag = (storeId: string) => ({ type: "OptionGroup" as const, id: storeId });

/** Choice groups of a store ("Escolha o queijo"); items attach them with optionGroupIds. */
export const optionGroupApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getOptionGroups: build.query<PaginatedList<OptionGroup>, StoreScopedListArg>({
      query: (arg) =>
        buildStoreListUrl(arg.storeId, "option-groups", {
          filters: arg.filters,
          pagination: arg.pagination,
          sort: arg.sort,
        }),
      providesTags: (_res, _err, arg) => [tag(arg.storeId)],
    }),
    createOptionGroup: build.mutation<OptionGroup, { storeId: string; data: OptionGroupInput }>({
      query: ({ storeId, data }) => ({ url: `stores/${storeId}/option-groups`, method: "POST", body: data }),
      extraOptions: { quiet: true },
      invalidatesTags: (_res, _err, { storeId }) => [tag(storeId)],
    }),
    updateOptionGroup: build.mutation<OptionGroup, { storeId: string; id: string; data: OptionGroupInput }>({
      query: ({ storeId, id, data }) => ({ url: `stores/${storeId}/option-groups/${id}`, method: "PUT", body: data }),
      extraOptions: { quiet: true },
      // Items show their groups' names: refresh them too.
      invalidatesTags: (_res, _err, { storeId }) => [tag(storeId), { type: "Item", id: `store-${storeId}` }],
    }),
    deleteOptionGroup: build.mutation<void, { storeId: string; id: string }>({
      query: ({ storeId, id }) => ({ url: `stores/${storeId}/option-groups/${id}`, method: "DELETE" }),
      invalidatesTags: (_res, _err, { storeId }) => [tag(storeId), { type: "Item", id: `store-${storeId}` }],
    }),
  }),
});

export const {
  useGetOptionGroupsQuery,
  useCreateOptionGroupMutation,
  useUpdateOptionGroupMutation,
  useDeleteOptionGroupMutation,
} = optionGroupApi;
