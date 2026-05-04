import { baseApi } from "@/redux/api/baseApi";

const categoryListTags = (storeId: string, categories: Category[]) => [
  ...categories.map((c) => ({ type: "Category" as const, id: String(c.id) })),
  { type: "Category" as const, id: `store-${storeId}` },
];

export const categoryApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getCategoriesByStoreId: build.query<Category[], string>({
      query: (storeId) => `stores/${storeId}/categories`,
      providesTags: (result, _err, storeId) =>
        result?.length
          ? categoryListTags(storeId, result)
          : [{ type: "Category" as const, id: `store-${storeId}` }],
    }),

    createCategory: build.mutation<
      Category,
      { storeId: string; data: Partial<Category> }
    >({
      query: ({ storeId, data }) => ({
        url: `stores/${storeId}/categories`,
        method: "POST",
        body: data,
      }),
      invalidatesTags: (_res, _err, { storeId }) => [
        { type: "Category", id: `store-${storeId}` },
        { type: "Store", id: storeId },
      ],
    }),

    updateCategory: build.mutation<
      Category,
      { storeId: string; categoryId: number; data: Partial<Category> }
    >({
      query: ({ storeId, categoryId, data }) => ({
        url: `stores/${storeId}/categories/${categoryId}`,
        method: "PUT",
        body: data,
      }),
      invalidatesTags: (res) =>
        res
          ? [
              { type: "Category", id: String(res.id) },
              { type: "Category", id: `store-${res.storeId}` },
            ]
          : [],
    }),

    updateCategoryOrder: build.mutation<
      Pick<Category, "id" | "order" | "updatedAt">[],
      { storeId: string; id: number; order: number }
    >({
      query: ({ storeId, id, order }) => ({
        url: `stores/${storeId}/categories/update-order`,
        method: "PATCH",
        body: { id, order },
      }),
      invalidatesTags: (_res, _err, arg) => [
        { type: "Category", id: `store-${arg.storeId}` },
      ],
    }),

    deleteCategory: build.mutation<void, { storeId: string; categoryId: number }>(
      {
        query: ({ storeId, categoryId }) => ({
          url: `stores/${storeId}/categories/${categoryId}`,
          method: "DELETE",
        }),
        invalidatesTags: (_res, _err, arg) => [
          { type: "Category", id: String(arg.categoryId) },
          { type: "Category", id: `store-${arg.storeId}` },
          { type: "Item", id: `store-${arg.storeId}` },
        ],
      }
    ),

    bulkDeleteCategories: build.mutation<
      { deletedCategories: Category[]; failedDeletions: Category[] },
      { storeId: string; ids: number[] }
    >({
      query: ({ storeId, ids }) => ({
        url: `stores/${storeId}/categories/bulk-delete`,
        method: "POST",
        body: { ids },
      }),
      invalidatesTags: (_res, _err, arg) => [
        { type: "Category", id: `store-${arg.storeId}` },
        { type: "Item", id: `store-${arg.storeId}` },
      ],
    }),
  }),
});

export const {
  useGetCategoriesByStoreIdQuery,
  useCreateCategoryMutation,
  useUpdateCategoryMutation,
  useUpdateCategoryOrderMutation,
  useDeleteCategoryMutation,
  useBulkDeleteCategoriesMutation,
} = categoryApi;
