import { baseApi } from "@/redux/api/baseApi";
import {
  buildStoreListUrl,
  type StoreScopedListArg,
} from "@/redux/api/listQueryParams";
import type { PaginatedList } from "@/types/paginated-list";

export const addonApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getAddonsByStoreId: build.query<PaginatedList<Addon>, StoreScopedListArg>({
      query: (arg) =>
        buildStoreListUrl(arg.storeId, "addons", {
          filters: arg.filters,
          pagination: arg.pagination,
          sort: arg.sort,
        }),
      providesTags: (result, _err, arg) =>
        result?.data?.length
          ? [
              ...result.data.map((a) => ({ type: "Addon" as const, id: a.id })),
              { type: "Addon" as const, id: `store-${arg.storeId}` },
            ]
          : [{ type: "Addon" as const, id: `store-${arg.storeId}` }],
    }),

    getAddonsByItemId: build.query<
      Addon[],
      { storeId: string; itemId: string }
    >({
      query: ({ storeId, itemId }) =>
        `stores/${storeId}/items/${itemId}/addons`,
      providesTags: (result, _err, arg) =>
        result?.length
          ? [
              ...result.map((a) => ({ type: "Addon" as const, id: a.id })),
              { type: "Addon" as const, id: `item-${arg.itemId}` },
            ]
          : [{ type: "Addon" as const, id: `item-${arg.itemId}` }],
    }),

    createAddon: build.mutation<
      Addon,
      { storeId: string; data: Partial<Addon> }
    >({
      query: ({ storeId, data }) => ({
        url: `stores/${storeId}/addons`,
        method: "POST",
        body: data,
      }),
      invalidatesTags: (_res, _err, { storeId }) => [
        { type: "Addon", id: `store-${storeId}` },
        { type: "Store", id: storeId },
      ],
    }),

    deleteAddonByStoreId: build.mutation<
      void,
      { storeId: string; addonId: string }
    >({
      query: ({ storeId, addonId }) => ({
        url: `stores/${storeId}/addons/${addonId}`,
        method: "DELETE",
      }),
      invalidatesTags: (_res, _err, arg) => [
        { type: "Addon", id: String(arg.addonId) },
        { type: "Addon", id: `store-${arg.storeId}` },
      ],
    }),

    bulkDeleteAddonsByStoreId: build.mutation<
      { deletedAddons: Addon[]; failedDeletions?: Addon[] },
      { storeId: string; ids: string[] }
    >({
      query: ({ storeId, ids }) => ({
        url: `stores/${storeId}/addons/bulk-delete`,
        method: "POST",
        body: { ids },
      }),
      invalidatesTags: (_res, _err, arg) => [
        { type: "Addon", id: `store-${arg.storeId}` },
      ],
    }),
  }),
});

export const {
  useGetAddonsByStoreIdQuery,
  useGetAddonsByItemIdQuery,
  useCreateAddonMutation,
  useDeleteAddonByStoreIdMutation,
  useBulkDeleteAddonsByStoreIdMutation,
} = addonApi;
