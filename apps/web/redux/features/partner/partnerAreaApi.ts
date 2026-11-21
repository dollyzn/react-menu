import { baseApi } from "@/redux/api/baseApi";
import { IDEMPOTENCY_HEADER } from "@/lib/idempotency";
import type {
  CreatePartnerOrderInput,
  PartnerCommissionOverview,
  PartnerContext,
  PartnerOrder,
  PublicMenu,
} from "@react-menu/contracts";

/** The partner's cache: their context, menu, orders and commission (ADR 0024). */
export const partnerTag = (storeId: string, part: "context" | "menu" | "orders" | "commission") => ({
  type: "Partner" as const,
  id: `${part}-${storeId}`,
});

/** The partner area (`/stores/:id/partner/*`): partners only. */
export const partnerAreaApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getPartnerContext: build.query<PartnerContext, string>({
      query: (storeId) => `stores/${storeId}/partner/context`,
      providesTags: (_res, _err, storeId) => [partnerTag(storeId, "context")],
    }),
    /** The store's menu, only what the partner may sell. */
    getPartnerMenu: build.query<PublicMenu, string>({
      query: (storeId) => `stores/${storeId}/partner/menu`,
      providesTags: (_res, _err, storeId) => [partnerTag(storeId, "menu"), { type: "Item", id: "PUBLIC_MENU" }],
    }),
    /** What is going on (any day) plus a business day's orders (`date`, today by default). */
    getPartnerOrders: build.query<PartnerOrder[], { storeId: string; date?: string }>({
      query: ({ storeId, date }) => `stores/${storeId}/partner/orders${date ? `?date=${date}` : ""}`,
      providesTags: (_res, _err, { storeId }) => [partnerTag(storeId, "orders")],
    }),
    /** `idempotencyKey`: kept across retries so a lost answer never sells twice. */
    createPartnerOrder: build.mutation<
      PartnerOrder,
      { storeId: string; input: CreatePartnerOrderInput; idempotencyKey: string }
    >({
      query: ({ storeId, input, idempotencyKey }) => ({
        url: `stores/${storeId}/partner/orders`,
        method: "POST",
        body: input,
        headers: { [IDEMPOTENCY_HEADER]: idempotencyKey },
      }),
      invalidatesTags: (_res, _err, { storeId }) => [partnerTag(storeId, "orders"), partnerTag(storeId, "commission")],
      extraOptions: { quiet: true },
    }),
    cancelPartnerOrder: build.mutation<PartnerOrder, { storeId: string; orderId: string }>({
      query: ({ storeId, orderId }) => ({ url: `stores/${storeId}/partner/orders/${orderId}/cancel`, method: "POST" }),
      invalidatesTags: (_res, _err, { storeId }) => [partnerTag(storeId, "orders"), partnerTag(storeId, "commission")],
    }),
    requestPartnerCancel: build.mutation<PartnerOrder, { storeId: string; orderId: string; reason: string }>({
      query: ({ storeId, orderId, reason }) => ({
        url: `stores/${storeId}/partner/orders/${orderId}/cancel-request`,
        method: "POST",
        body: { reason },
      }),
      invalidatesTags: (_res, _err, { storeId }) => [partnerTag(storeId, "orders")],
    }),
    deliverPartnerOrder: build.mutation<PartnerOrder, { storeId: string; orderId: string }>({
      query: ({ storeId, orderId }) => ({ url: `stores/${storeId}/partner/orders/${orderId}/deliver`, method: "POST" }),
      invalidatesTags: (_res, _err, { storeId }) => [partnerTag(storeId, "orders")],
    }),
    getPartnerCommission: build.query<PartnerCommissionOverview, string>({
      query: (storeId) => `stores/${storeId}/partner/commissions`,
      providesTags: (_res, _err, storeId) => [partnerTag(storeId, "commission")],
    }),
  }),
});

export const {
  useGetPartnerContextQuery,
  useGetPartnerMenuQuery,
  useGetPartnerOrdersQuery,
  useCreatePartnerOrderMutation,
  useCancelPartnerOrderMutation,
  useRequestPartnerCancelMutation,
  useDeliverPartnerOrderMutation,
  useGetPartnerCommissionQuery,
} = partnerAreaApi;
