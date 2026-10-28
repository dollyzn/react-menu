import type { BulkUpdateChange } from "@react-menu/contracts";
import type { BulkDeleteResult } from "@/types/request";
import { baseApi } from "@/redux/api/baseApi";
import {
  buildStoreListUrl,
  type StoreScopedListArg,
} from "@/redux/api/listQueryParams";
import type { PaginatedList } from "@/types/paginated-list";

/** What an item change refreshes: the item, its lists, the public menu and its add-ons. */
function itemChangedTags(res: Item | undefined) {
  const tags: Array<{ type: "Item" | "Category" | "Addon"; id: string }> = [];
  if (res?.id) tags.push({ type: "Item", id: res.id });
  tags.push({ type: "Item", id: "PUBLIC_MENU" });
  if (res?.categoryId != null) tags.push({ type: "Item", id: `category-${res.categoryId}` });
  const storeId = res?.category?.storeId;
  if (storeId) {
    tags.push({ type: "Item", id: `store-${storeId}` });
    tags.push({ type: "Addon", id: `item-${res.id}` });
  }
  return tags;
}

export const itemApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getItemsByStoreId: build.query<PaginatedList<Item>, StoreScopedListArg>({
      query: (arg) =>
        buildStoreListUrl(arg.storeId, "items", {
          filters: arg.filters,
          pagination: arg.pagination,
          sort: arg.sort,
        }),
      providesTags: (result, _err, arg) =>
        result?.data?.length
          ? [
              ...result.data.map((i) => ({ type: "Item" as const, id: i.id })),
              { type: "Item" as const, id: `store-${arg.storeId}` },
            ]
          : [{ type: "Item" as const, id: `store-${arg.storeId}` }],
    }),

    getItemsByCategoryId: build.query<
      Item[],
      { storeId: string; categoryId: number }
    >({
      query: ({ storeId, categoryId }) =>
        `stores/${storeId}/categories/${categoryId}/items`,
      providesTags: (result, _err, arg) =>
        result?.length
          ? [
              ...result.map((i) => ({ type: "Item" as const, id: i.id })),
              { type: "Item" as const, id: `category-${arg.categoryId}` },
            ]
          : [{ type: "Item" as const, id: `category-${arg.categoryId}` }],
    }),

    createItem: build.mutation<
      Item,
      {
        storeId: string;
        categoryId: number;
        data: Partial<Item & { addonIds?: string[]; optionGroupIds?: string[] }>;
      }
    >({
      query: ({ storeId, categoryId, data }) => ({
        url: `stores/${storeId}/categories/${categoryId}/items`,
        method: "POST",
        body: data,
      }),
      invalidatesTags: (res) => {
        const tags: Array<{ type: "Item" | "Category"; id: string }> = [];
        if (res?.categoryId != null)
          tags.push({ type: "Item", id: `category-${res.categoryId}` });
        const storeId = res?.category?.storeId;
        if (storeId) {
          tags.push({ type: "Item", id: `store-${storeId}` });
          tags.push({ type: "Category", id: `store-${storeId}` });
        }
        return tags;
      },
    }),

    updateItem: build.mutation<
      Item,
      {
        storeId: string;
        itemId: string;
        data: Partial<Item & { addonIds?: string[]; optionGroupIds?: string[] }>;
      }
    >({
      query: ({ storeId, itemId, data }) => ({
        url: `stores/${storeId}/items/${itemId}`,
        method: "PUT",
        body: data,
      }),
      invalidatesTags: (res) => itemChangedTags(res),
    }),

    /**
     * The item's photo (multipart). The form sends it already resized to
     * WebP (`lib/image-compress.ts`); the API stores it and deletes the old one.
     */
    uploadItemPhoto: build.mutation<Item, { storeId: string; itemId: string; photo: Blob }>({
      query: ({ storeId, itemId, photo }) => {
        const body = new FormData();
        body.append("photo", photo, `foto.${photo.type === "image/webp" ? "webp" : "jpg"}`);
        return { url: `stores/${storeId}/items/${itemId}/photo`, method: "PUT", body };
      },
      // The form says what went wrong (the item itself was saved).
      extraOptions: { quiet: true },
      invalidatesTags: (res) => itemChangedTags(res),
    }),

    removeItemPhoto: build.mutation<Item, { storeId: string; itemId: string }>({
      query: ({ storeId, itemId }) => ({ url: `stores/${storeId}/items/${itemId}/photo`, method: "DELETE" }),
      extraOptions: { quiet: true },
      invalidatesTags: (res) => itemChangedTags(res),
    }),

    deleteItemByStoreId: build.mutation<void, { storeId: string; itemId: string }>({
      query: ({ storeId, itemId }) => ({
        url: `stores/${storeId}/items/${itemId}`,
        method: "DELETE",
      }),
      invalidatesTags: (_res, _err, arg) => [
        { type: "Item", id: String(arg.itemId) },
        { type: "Item", id: `store-${arg.storeId}` },
      ],
    }),

    /** All or nothing; a 409 (rows changed meanwhile) refetches the list too. */
    bulkUpdateItemsByStoreId: build.mutation<
      { updated: number },
      { storeId: string; changes: BulkUpdateChange[] }
    >({
      query: ({ storeId, changes }) => ({
        url: `stores/${storeId}/items/bulk-update`,
        method: "POST",
        body: { changes },
      }),
      // The dialog explains a conflict itself.
      extraOptions: { quiet: true },
      invalidatesTags: (_res, _err, arg) => [
        { type: "Item", id: `store-${arg.storeId}` },
      ],
    }),
    bulkDeleteItemsByStoreId: build.mutation<
      BulkDeleteResult<Item>,
      { storeId: string; ids: string[] }
    >({
      query: ({ storeId, ids }) => ({
        url: `stores/${storeId}/items/bulk-delete`,
        method: "POST",
        body: { ids },
      }),
      invalidatesTags: (_res, _err, arg) => [
        { type: "Item", id: `store-${arg.storeId}` },
      ],
    }),

    /** Persists the full item order of a category. */
    reorderItems: build.mutation<
      void,
      { storeId: string; categoryId: number; ids: string[] }
    >({
      query: ({ storeId, categoryId, ids }) => ({
        url: `stores/${storeId}/categories/${categoryId}/items/order`,
        method: "PUT",
        body: { ids },
      }),
      invalidatesTags: (_res, _err, arg) => [
        { type: "Item", id: `category-${arg.categoryId}` },
        { type: "Item", id: `store-${arg.storeId}` },
      ],
    }),
  }),
});

export const {
  useGetItemsByStoreIdQuery,
  useGetItemsByCategoryIdQuery,
  useLazyGetItemsByCategoryIdQuery,
  useCreateItemMutation,
  useUpdateItemMutation,
  useUploadItemPhotoMutation,
  useRemoveItemPhotoMutation,
  useDeleteItemByStoreIdMutation,
  useBulkDeleteItemsByStoreIdMutation,
  useBulkUpdateItemsByStoreIdMutation,
  useReorderItemsMutation,
} = itemApi;
