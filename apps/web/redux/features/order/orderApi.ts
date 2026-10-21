import { baseApi } from "@/redux/api/baseApi";
import { IDEMPOTENCY_HEADER } from "@/lib/idempotency";
import type {
  CreatePosOrderInput,
  Order,
  OrderStatus,
  ProductionBatch,
} from "@react-menu/contracts";

const ordersTag = (storeId: string) => ({ type: "Order" as const, id: `store-${storeId}` });
const kitchenTag = (storeId: string) => ({ type: "Kitchen" as const, id: storeId });

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
      invalidatesTags: (_res, _err, { storeId }) => [ordersTag(storeId)],
    }),

    cancelOrder: build.mutation<Order, { storeId: string; orderId: string }>({
      query: ({ storeId, orderId }) => ({ url: `stores/${storeId}/orders/${orderId}/cancel`, method: "POST" }),
      invalidatesTags: (_res, _err, { storeId }) => [ordersTag(storeId), kitchenTag(storeId)],
    }),

    markOrderPaid: build.mutation<Order, { storeId: string; orderId: string }>({
      query: ({ storeId, orderId }) => ({ url: `stores/${storeId}/orders/${orderId}/payment`, method: "POST" }),
      invalidatesTags: (_res, _err, { storeId }) => [ordersTag(storeId), kitchenTag(storeId)],
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
  useCreatePosOrderMutation,
  useCompleteOrderMutation,
  useCancelOrderMutation,
  useMarkOrderPaidMutation,
  useGetKitchenQueueQuery,
  usePrepareUnitsMutation,
} = orderApi;
