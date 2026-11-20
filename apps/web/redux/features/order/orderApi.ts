import { baseApi } from "@/redux/api/baseApi";
import { IDEMPOTENCY_HEADER } from "@/lib/idempotency";
import { buildStoreListUrl, type StoreScopedListArg } from "@/redux/api/listQueryParams";
import type { PaginatedList } from "@/types/paginated-list";
import type {
  AddOrderItemsInput,
  CounterPaymentMethod,
  ReceivePaymentInput,
  CreatePosOrderInput,
  CustomerSuggestion,
  Order,
  OrderStatus,
  PayLaterCustomer,
  PayLaterCustomerSort,
  PayLaterInput,
  ReceivePayLaterInput,
  ReceivePayLaterResult,
  PayLaterOrder,
  PayLaterSummary,
  ProductionBatch,
} from "@react-menu/contracts";

const ordersTag = (storeId: string) => ({ type: "Order" as const, id: `store-${storeId}` });
const kitchenTag = (storeId: string) => ({ type: "Kitchen" as const, id: storeId });
const orderTag = (orderId: string) => ({ type: "Order" as const, id: orderId });
/**
 * The managers' "Pagar depois" (every day, so not refetched on every board
 * event): changed by sending, marking, receiving, delivering or cancelling.
 */
const payLaterTag = (storeId: string) => ({ type: "Order" as const, id: `pay-later-${storeId}` });

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
      query: ({ storeId, filters, pagination, sort, facets }) =>
        buildStoreListUrl(storeId, "orders", {
          facets,
          filters,
          pagination: { page: pagination?.page ?? 1, pageSize: pagination?.pageSize },
          sort: sort?.slice(0, 1),
        }),
      providesTags: (_res, _err, { storeId }) => [ordersTag(storeId)],
    }),

    /** Managers: "Pagar depois" (fiado) still open, any day: search, sort and pages. */
    getPayLaterOrders: build.query<PaginatedList<PayLaterOrder>, StoreScopedListArg>({
      query: ({ storeId, filters, pagination, sort }) =>
        buildStoreListUrl(storeId, "orders/pay-later", {
          filters,
          pagination: { page: pagination?.page ?? 1, pageSize: pagination?.pageSize },
          sort: sort?.slice(0, 1),
        }),
      providesTags: (_res, _err, { storeId }) => [payLaterTag(storeId)],
    }),

    /** Managers: open "pagar depois" by customer, with their orders. */
    getPayLaterCustomers: build.query<
      PaginatedList<PayLaterCustomer>,
      { storeId: string; search?: string; sort: PayLaterCustomerSort; page: number; perPage: number }
    >({
      query: ({ storeId, search, sort, page, perPage }) => {
        const params = new URLSearchParams({ sort, page: String(page), perPage: String(perPage) });
        if (search) params.set("search", search);
        return `stores/${storeId}/orders/pay-later/customers?${params}`;
      },
      providesTags: (_res, _err, { storeId }) => [payLaterTag(storeId)],
    }),

    /** Managers: several open orders of one customer received at once. */
    receivePayLater: build.mutation<ReceivePayLaterResult, { storeId: string } & ReceivePayLaterInput>({
      query: ({ storeId, ...body }) => ({ url: `stores/${storeId}/orders/pay-later/receive`, method: "POST", body }),
      invalidatesTags: (_res, _err, { storeId, orderIds }) => [
        ordersTag(storeId),
        payLaterTag(storeId),
        ...orderIds.map(orderTag),
      ],
    }),

    /** Managers: the tab's count and who owes the most. */
    getPayLaterSummary: build.query<PayLaterSummary, string>({
      query: (storeId) => `stores/${storeId}/orders/pay-later/summary`,
      providesTags: (_res, _err, storeId) => [payLaterTag(storeId)],
    }),

    /** "Pagar depois" on an order sent unpaid (the phone when it has none). */
    markPayLater: build.mutation<Order, { storeId: string; orderId: string } & PayLaterInput>({
      query: ({ storeId, orderId, name, phone }) => ({
        url: `stores/${storeId}/orders/${orderId}/pay-later`,
        method: "POST",
        body: { name, phone } satisfies PayLaterInput,
      }),
      invalidatesTags: (_res, _err, { storeId, orderId }) => [ordersTag(storeId), orderTag(orderId), payLaterTag(storeId)],
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
      invalidatesTags: (_res, _err, { storeId, input }) => [
        ordersTag(storeId),
        kitchenTag(storeId),
        ...(input.payLater ? [payLaterTag(storeId)] : []),
      ],
    }),

    /** Items added to an order still in the queue (a drink more): charged now or left to receive. */
    addOrderItems: build.mutation<
      Order,
      { storeId: string; orderId: string; input: AddOrderItemsInput; idempotencyKey: string }
    >({
      query: ({ storeId, orderId, input, idempotencyKey }) => ({
        url: `stores/${storeId}/orders/${orderId}/items`,
        method: "POST",
        body: input,
        headers: { [IDEMPOTENCY_HEADER]: idempotencyKey },
      }),
      invalidatesTags: (_res, _err, { storeId, orderId }) => [
        ordersTag(storeId),
        kitchenTag(storeId),
        orderTag(orderId),
        payLaterTag(storeId),
      ],
    }),

    completeOrder: build.mutation<Order, { storeId: string; orderId: string }>({
      query: ({ storeId, orderId }) => ({ url: `stores/${storeId}/orders/${orderId}/complete`, method: "POST" }),
      invalidatesTags: (_res, _err, { storeId, orderId }) => [ordersTag(storeId), orderTag(orderId), payLaterTag(storeId)],
    }),

    cancelOrder: build.mutation<Order, { storeId: string; orderId: string }>({
      query: ({ storeId, orderId }) => ({ url: `stores/${storeId}/orders/${orderId}/cancel`, method: "POST" }),
      invalidatesTags: (_res, _err, { storeId, orderId }) => [
        ordersTag(storeId),
        kitchenTag(storeId),
        orderTag(orderId),
        payLaterTag(storeId),
      ],
    }),

    /** Managers: retry the refund of a cancelled paid order. */
    refundOrder: build.mutation<Order, { storeId: string; orderId: string }>({
      query: ({ storeId, orderId }) => ({ url: `stores/${storeId}/orders/${orderId}/refund`, method: "POST" }),
      invalidatesTags: (_res, _err, { storeId, orderId }) => [ordersTag(storeId), orderTag(orderId)],
    }),

    /** "Receber pagamento" at the counter: how it was paid (recorded with who received it). */
    receiveOrderPayment: build.mutation<
      Order,
      { storeId: string; orderId: string; method: CounterPaymentMethod; amount?: number }
    >({
      query: ({ storeId, orderId, method, amount }) => ({
        url: `stores/${storeId}/orders/${orderId}/payment`,
        method: "POST",
        body: { method, amount } satisfies ReceivePaymentInput,
      }),
      invalidatesTags: (_res, _err, { storeId, orderId }) => [
        ordersTag(storeId),
        kitchenTag(storeId),
        orderTag(orderId),
        payLaterTag(storeId),
      ],
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
  useGetPayLaterOrdersQuery,
  useGetPayLaterCustomersQuery,
  useReceivePayLaterMutation,
  useGetPayLaterSummaryQuery,
  useMarkPayLaterMutation,
  useSearchCustomersQuery,
  useCreatePosOrderMutation,
  useAddOrderItemsMutation,
  useCompleteOrderMutation,
  useCancelOrderMutation,
  useReceiveOrderPaymentMutation,
  useRefundOrderMutation,
  useGetKitchenQueueQuery,
  usePrepareUnitsMutation,
} = orderApi;
