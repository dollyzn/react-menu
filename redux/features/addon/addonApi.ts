import { baseApi } from "@/redux/api/baseApi";

export const addonApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getAddonsByStoreId: build.query<Addon[], string>({
      query: (storeId) => `stores/${storeId}/addons`,
      providesTags: (result, _err, storeId) =>
        result?.length
          ? [
              ...result.map((a) => ({ type: "Addon" as const, id: a.id })),
              { type: "Addon" as const, id: `store-${storeId}` },
            ]
          : [{ type: "Addon" as const, id: `store-${storeId}` }],
    }),

    getAddonsByItemId: build.query<Addon[], string>({
      query: (itemId) => `items/${itemId}/addons`,
      providesTags: (result, _err, itemId) =>
        result?.length
          ? [
              ...result.map((a) => ({ type: "Addon" as const, id: a.id })),
              { type: "Addon" as const, id: `item-${itemId}` },
            ]
          : [{ type: "Addon" as const, id: `item-${itemId}` }],
    }),

    createAddon: build.mutation<
      Addon,
      { storeId: string; data: Partial<Addon> }
    >({
      query: ({ storeId, data }) => ({
        url: `addons/${storeId}`,
        method: "POST",
        body: data,
      }),
      invalidatesTags: (_res, _err, { storeId }) => [
        { type: "Addon", id: `store-${storeId}` },
        { type: "Store", id: storeId },
      ],
    }),
  }),
});

export const {
  useGetAddonsByStoreIdQuery,
  useGetAddonsByItemIdQuery,
  useLazyGetAddonsByItemIdQuery,
  useCreateAddonMutation,
} = addonApi;
