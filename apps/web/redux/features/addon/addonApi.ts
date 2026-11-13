import type { BulkUpdateChange } from "@react-menu/contracts";
import type { BulkDeleteResult } from "@/types/request";
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

    updateAddonByStoreId: build.mutation<
      Addon,
      { storeId: string; addonId: string; data: Partial<Addon> }
    >({
      query: ({ storeId, addonId, data }) => ({
        url: `stores/${storeId}/addons/${addonId}`,
        method: "PUT",
        body: data,
      }),
      invalidatesTags: (res, _err, arg) => [
        { type: "Addon", id: String(res?.id ?? arg.addonId) },
        { type: "Addon", id: `store-${arg.storeId}` },
      ],
    }),

    /**
     * The add-on's photo (multipart), like an item's: the form sends it
     * resized to WebP; the API stores it and deletes the old one. The menu
     * and the POS show it with the options.
     */
    uploadAddonPhoto: build.mutation<Addon, { storeId: string; addonId: string; photo: Blob }>({
      query: ({ storeId, addonId, photo }) => {
        const body = new FormData();
        body.append("photo", photo, `foto.${photo.type === "image/webp" ? "webp" : "jpg"}`);
        return { url: `stores/${storeId}/addons/${addonId}/photo`, method: "PUT", body };
      },
      // The form says what went wrong (the add-on itself was saved).
      extraOptions: { quiet: true },
      invalidatesTags: (_res, _err, arg) => [
        { type: "Addon", id: arg.addonId },
        { type: "Addon", id: `store-${arg.storeId}` },
        { type: "Item", id: "PUBLIC_MENU" },
      ],
    }),

    removeAddonPhoto: build.mutation<Addon, { storeId: string; addonId: string }>({
      query: ({ storeId, addonId }) => ({ url: `stores/${storeId}/addons/${addonId}/photo`, method: "DELETE" }),
      extraOptions: { quiet: true },
      invalidatesTags: (_res, _err, arg) => [
        { type: "Addon", id: arg.addonId },
        { type: "Addon", id: `store-${arg.storeId}` },
        { type: "Item", id: "PUBLIC_MENU" },
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

    /** All or nothing; a 409 (rows changed meanwhile) refetches the list too. */
    bulkUpdateAddonsByStoreId: build.mutation<
      { updated: number },
      { storeId: string; changes: BulkUpdateChange[] }
    >({
      query: ({ storeId, changes }) => ({
        url: `stores/${storeId}/addons/bulk-update`,
        method: "POST",
        body: { changes },
      }),
      // The dialog explains a conflict itself.
      extraOptions: { quiet: true },
      invalidatesTags: (_res, _err, arg) => [
        { type: "Addon", id: `store-${arg.storeId}` },
      ],
    }),
    bulkDeleteAddonsByStoreId: build.mutation<
      BulkDeleteResult<Addon>,
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
  useUpdateAddonByStoreIdMutation,
  useDeleteAddonByStoreIdMutation,
  useBulkDeleteAddonsByStoreIdMutation,
  useBulkUpdateAddonsByStoreIdMutation,
  useUploadAddonPhotoMutation,
  useRemoveAddonPhotoMutation,
} = addonApi;
