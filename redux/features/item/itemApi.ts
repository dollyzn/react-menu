import { baseApi } from "@/redux/api/baseApi";

export const itemApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getItemsByStoreId: build.query<Item[], string>({
      query: (storeId) => `stores/${storeId}/items`,
      providesTags: (result, _err, storeId) =>
        result?.length
          ? [
              ...result.map((i) => ({ type: "Item" as const, id: i.id })),
              { type: "Item" as const, id: `store-${storeId}` },
            ]
          : [{ type: "Item" as const, id: `store-${storeId}` }],
    }),

    getItemsByCategoryId: build.query<Item[], number>({
      query: (categoryId) => `categories/${categoryId}/items`,
      providesTags: (result, _err, categoryId) =>
        result?.length
          ? [
              ...result.map((i) => ({ type: "Item" as const, id: i.id })),
              { type: "Item" as const, id: `category-${categoryId}` },
            ]
          : [{ type: "Item" as const, id: `category-${categoryId}` }],
    }),

    createItem: build.mutation<
      Item,
      { categoryId: string; data: Partial<Item & { addonIds?: string[] }> }
    >({
      query: ({ categoryId, data }) => ({
        url: `items/${categoryId}`,
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
      { id: string; data: Partial<Item & { addonIds?: string[] }> }
    >({
      query: ({ id, data }) => ({
        url: `items/${id}`,
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

    updateItemOrder: build.mutation<
      Pick<Item, "id" | "order" | "updatedAt">[],
      { categoryId: number; id: string | number; order: number }
    >({
      query: ({ id, order }) => ({
        url: `items/update-order`,
        method: "PATCH",
        body: { id, order },
      }),
      invalidatesTags: (_res, _err, arg) => [
        { type: "Item", id: `category-${arg.categoryId}` },
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
  useUpdateItemOrderMutation,
} = itemApi;
