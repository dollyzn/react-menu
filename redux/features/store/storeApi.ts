import { baseApi } from "@/redux/api/baseApi";
import type {
  StoreOverview,
  StoreOverviewChartPoint,
} from "@/types/store-dashboard";

const storeTag = (id: string) => ({ type: "Store" as const, id });

export const storeApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getStoreById: build.query<Store, string>({
      query: (id) => `stores/${id}`,
      providesTags: (_res, _err, id) => [storeTag(id)],
    }),

    updateStore: build.mutation<
      Store,
      { id: string; data: Partial<Store> }
    >({
      query: ({ id, data }) => ({
        url: `stores/${id}`,
        method: "PUT",
        body: data,
      }),
      invalidatesTags: (_res, _err, { id }) => [storeTag(id)],
    }),

    updateStoreImages: build.mutation<
      Store,
      { id: string; banner?: File; photo?: File }
    >({
      query: ({ id, banner, photo }) => {
        const body = new FormData();
        if (banner) body.append("banner", banner);
        if (photo) body.append("photo", photo);
        return {
          url: `stores/${id}/images`,
          method: "PATCH",
          body,
        };
      },
      invalidatesTags: (_res, _err, { id }) => [storeTag(id)],
    }),

    updateStoreStatus: build.mutation<
      Store,
      { id: string; status: Store["status"] }
    >({
      query: ({ id, status }) => ({
        url: `stores/${id}/status`,
        method: "PATCH",
        body: { status },
      }),
      invalidatesTags: (_res, _err, { id }) => [storeTag(id)],
    }),

    getStoreOverview: build.query<StoreOverview, string>({
      query: (storeId) => `stores/${storeId}/dashboard/overview`,
      providesTags: (_res, _err, storeId) => [storeTag(storeId)],
    }),

    getStoreRecentItems: build.query<Item[], string>({
      query: (storeId) => `stores/${storeId}/dashboard/recent-items`,
      providesTags: (_res, _err, storeId) => [storeTag(storeId)],
    }),

    getStoreChart: build.query<StoreOverviewChartPoint[], string>({
      query: (storeId) => `stores/${storeId}/dashboard/chart`,
      providesTags: (_res, _err, storeId) => [storeTag(storeId)],
    }),
  }),
});

export const {
  useGetStoreByIdQuery,
  useLazyGetStoreByIdQuery,
  useUpdateStoreMutation,
  useUpdateStoreImagesMutation,
  useUpdateStoreStatusMutation,
  useGetStoreOverviewQuery,
  useGetStoreRecentItemsQuery,
  useGetStoreChartQuery,
} = storeApi;
