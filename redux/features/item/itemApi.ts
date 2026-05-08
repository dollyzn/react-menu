import { baseApi } from "@/redux/api/baseApi";
import {
  buildStoreListUrl,
  type StoreScopedListArg,
} from "@/redux/api/listQueryParams";
import type { PaginatedList } from "@/types/paginated-list";

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
        data: Partial<Item & { addonIds?: string[] }>;
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
        data: Partial<Item & { addonIds?: string[] }>;
      }
    >({
      query: ({ storeId, itemId, data }) => ({
        url: `stores/${storeId}/items/${itemId}`,
        method: "PUT",
        body: data,
      }),
      invalidatesTags: (res) => {
        const tags: Array<{ type: "Item" | "Category" | "Addon"; id: string }> =
          [];
        if (res?.id) tags.push({ type: "Item", id: res.id });
        if (res?.categoryId != null)
          tags.push({ type: "Item", id: `category-${res.categoryId}` });
        const storeId = res?.category?.storeId;
        if (storeId) {
          tags.push({ type: "Item", id: `store-${storeId}` });
          tags.push({ type: "Addon", id: `item-${res.id}` });
        }
        return tags;
      },
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

    bulkDeleteItemsByStoreId: build.mutation<
      { deletedItems: Item[]; failedDeletions?: Item[] },
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

    updateItemOrder: build.mutation<
      void,
      { storeId: string; categoryId: number; id: string; order: number }
    >({
      query: ({ storeId, id, order }) => ({
        url: `stores/${storeId}/items/update-order`,
        method: "PATCH",
        body: { id, order },
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
  useDeleteItemByStoreIdMutation,
  useBulkDeleteItemsByStoreIdMutation,
  useUpdateItemOrderMutation,
} = itemApi;
