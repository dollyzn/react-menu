import { baseApi } from "@/redux/api/baseApi";
import { IDEMPOTENCY_HEADER } from "@/lib/idempotency";
import { buildStoreListUrl, type StoreScopedListArg } from "@/redux/api/listQueryParams";
import type { PaginatedList } from "@/types/paginated-list";
import type {
  CreatePosOrderInput,
  CustomerSuggestion,
  Order,
  OrderStatus,
  ProductionBatch,
} from "@react-menu/contracts";

const ordersTag = (storeId: string) => ({ type: "Order" as const, id: `store-${storeId}` });
const kitchenTag = (storeId: string) => ({ type: "Kitchen" as const, id: storeId });
const orderTag = (orderId: string) => ({ type: "Order" as const, id: orderId });

export const orderApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    /** Today's orders (business day in the store's timezone). */
    getOrders: build.query<Order[], { storeId: string; status?: OrderStatus[] }>({
      query: ({ storeId, status }) => {
        const params = new URLSearchParams();
        status?.forEach((s) => params.append("status", s));
        const qs = params.toString();
        return `stores/${storeId}/orders${qs ? `?${qs}` : ""}`;
      },
      providesTags: (_res, _err, { storeId }) => [ordersTag(storeId)],
    }),

    /** History: any period, filters and pagination (see GET /orders?page=). */
    getOrdersPage: build.query<PaginatedList<Order>, StoreScopedListArg>({
      query: ({ storeId, filters, pagination, sort }) =>
        buildStoreListUrl(storeId, "orders", {
          filters,
          pagination: { page: pagination?.page ?? 1, pageSize: pagination?.pageSize },
          sort: sort?.slice(0, 1),
        }),
      providesTags: (_res, _err, { storeId }) => [ordersTag(storeId)],
    }),

    /** One order with its status history (who changed what). */
    getOrder: build.query<Order, { storeId: string; orderId: string }>({
      query: ({ storeId, orderId }) => `stores/${storeId}/orders/${orderId}`,
      providesTags: (_res, _err, { orderId }) => [orderTag(orderId)],
    }),

    /** POS autocomplete: customers by name or part of the phone. */
    searchCustomers: build.query<CustomerSuggestion[], { storeId: string; search: string }>({
      query: ({ storeId, search }) => `stores/${storeId}/customers?search=${encodeURIComponent(search)}`,
      keepUnusedDataFor: 30,
    }),

    createPosOrder: build.mutation<
      Order,
      { storeId: string; input: CreatePosOrderInput; idempotencyKey: string }
    >({
      query: ({ storeId, input, idempotencyKey }) => ({
        url: `stores/${storeId}/orders`,
        method: "POST",
        body: input,
        headers: { [IDEMPOTENCY_HEADER]: idempotencyKey },
      }),
      invalidatesTags: (_res, _err, { storeId }) => [ordersTag(storeId), kitchenTag(storeId)],
    }),

    completeOrder: build.mutation<Order, { storeId: string; orderId: string }>({
      query: ({ storeId, orderId }) => ({ url: `stores/${storeId}/orders/${orderId}/complete`, method: "POST" }),
      invalidatesTags: (_res, _err, { storeId, orderId }) => [ordersTag(storeId), orderTag(orderId)],
    }),

    cancelOrder: build.mutation<Order, { storeId: string; orderId: string }>({
      query: ({ storeId, orderId }) => ({ url: `stores/${storeId}/orders/${orderId}/cancel`, method: "POST" }),
      invalidatesTags: (_res, _err, { storeId, orderId }) => [ordersTag(storeId), kitchenTag(storeId), orderTag(orderId)],
    }),

    markOrderPaid: build.mutation<Order, { storeId: string; orderId: string }>({
      query: ({ storeId, orderId }) => ({ url: `stores/${storeId}/orders/${orderId}/payment`, method: "POST" }),
      invalidatesTags: (_res, _err, { storeId, orderId }) => [ordersTag(storeId), kitchenTag(storeId), orderTag(orderId)],
    }),

    getKitchenQueue: build.query<ProductionBatch[], string>({
      query: (storeId) => `stores/${storeId}/kitchen/queue`,
      providesTags: (_res, _err, storeId) => [kitchenTag(storeId)],
    }),

    /** Marks units as made; negative quantities undo. */
    prepareUnits: build.mutation<
      void,
      { storeId: string; units: { lineId: number; quantity: number }[] }
    >({
      query: ({ storeId, units }) => ({ url: `stores/${storeId}/kitchen/prepare`, method: "POST", body: { units } }),
      invalidatesTags: (_res, _err, { storeId }) => [kitchenTag(storeId), ordersTag(storeId)],
    }),
  }),
});

export const {
  useGetOrdersQuery,
  useGetOrdersPageQuery,
  useGetOrderQuery,
  useSearchCustomersQuery,
  useCreatePosOrderMutation,
  useCompleteOrderMutation,
  useCancelOrderMutation,
  useMarkOrderPaidMutation,
  useGetKitchenQueueQuery,
  usePrepareUnitsMutation,
} = orderApi;
