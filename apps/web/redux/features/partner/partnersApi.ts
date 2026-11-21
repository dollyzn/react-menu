import { baseApi } from "@/redux/api/baseApi";
import type { PaginatedList } from "@/types/paginated-list";
import { buildStoreListUrl, type StoreScopedListArg } from "@/redux/api/listQueryParams";
import type {
  PartnerCatalogInput,
  PartnerInput,
  PartnerListRow,
  PartnerSaleRow,
  PartnerStats,
  PartnerSettlement,
  PendingCancelRequest,
  SettlePartnerInput,
  StorePartner,
} from "@react-menu/contracts";

const listTag = (storeId: string) => ({ type: "Partner" as const, id: `list-${storeId}` });
const salesTag = (storeId: string) => ({ type: "Partner" as const, id: `sales-${storeId}` });
const requestsTag = (storeId: string) => ({ type: "Partner" as const, id: `requests-${storeId}` });
const ordersTag = (storeId: string) => ({ type: "Order" as const, id: `store-${storeId}` });

/** The managers' side of partners (ADR 0024). */
export const partnersApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getPartners: build.query<StorePartner[], string>({
      query: (storeId) => `stores/${storeId}/partners`,
      providesTags: (_res, _err, storeId) => [listTag(storeId)],
    }),
    createPartner: build.mutation<StorePartner, { storeId: string; input: PartnerInput }>({
      query: ({ storeId, input }) => ({ url: `stores/${storeId}/partners`, method: "POST", body: input }),
      invalidatesTags: (_res, _err, { storeId }) => [listTag(storeId)],
    }),
    updatePartner: build.mutation<StorePartner, { storeId: string; partnerId: string; input: PartnerInput }>({
      query: ({ storeId, partnerId, input }) => ({
        url: `stores/${storeId}/partners/${partnerId}`,
        method: "PUT",
        body: input,
      }),
      invalidatesTags: (_res, _err, { storeId }) => [listTag(storeId), salesTag(storeId)],
    }),
    pausePartner: build.mutation<StorePartner, { storeId: string; partnerId: string; paused: boolean }>({
      query: ({ storeId, partnerId, paused }) => ({
        url: `stores/${storeId}/partners/${partnerId}/pause`,
        method: "PUT",
        body: { paused },
      }),
      invalidatesTags: (_res, _err, { storeId }) => [listTag(storeId), salesTag(storeId)],
    }),
    setPartnerCatalog: build.mutation<
      StorePartner,
      { storeId: string; partnerId: string; input: PartnerCatalogInput }
    >({
      query: ({ storeId, partnerId, input }) => ({
        url: `stores/${storeId}/partners/${partnerId}/catalog`,
        method: "PUT",
        body: input,
      }),
      invalidatesTags: (_res, _err, { storeId }) => [listTag(storeId)],
    }),
    /** The managers' table: the period (`createdAt=from~to`) per partner, filters and sort in the URL. */
    getPartnersPage: build.query<PaginatedList<PartnerListRow>, StoreScopedListArg>({
      query: ({ storeId, ...rest }) => buildStoreListUrl(storeId, "partners", rest),
      providesTags: (_res, _err, { storeId }) => [listTag(storeId), salesTag(storeId)],
    }),
    getPartner: build.query<StorePartner, { storeId: string; partnerId: string }>({
      query: ({ storeId, partnerId }) => `stores/${storeId}/partners/${partnerId}`,
      providesTags: (_res, _err, { storeId }) => [listTag(storeId)],
    }),
    /** The overview: the period against the one before, day by day. */
    getPartnerStats: build.query<PartnerStats, { storeId: string; partnerId: string; from: string; to: string }>({
      query: ({ storeId, partnerId, from, to }) => `stores/${storeId}/partners/${partnerId}/stats?from=${from}&to=${to}`,
      providesTags: (_res, _err, { storeId }) => [salesTag(storeId)],
    }),
    /** The sales table, like the order history (`createdAt`, `settlement`, `customerName`). */
    getPartnerSales: build.query<PaginatedList<PartnerSaleRow>, StoreScopedListArg & { partnerId: string }>({
      query: ({ storeId, partnerId, ...rest }) => buildStoreListUrl(storeId, `partners/${partnerId}/sales`, rest),
      providesTags: (_res, _err, { storeId }) => [salesTag(storeId)],
    }),
    getPartnerSettlements: build.query<PartnerSettlement[], { storeId: string; partnerId: string }>({
      query: ({ storeId, partnerId }) => `stores/${storeId}/partners/${partnerId}/settlements`,
      providesTags: (_res, _err, { storeId }) => [salesTag(storeId)],
    }),
    settlePartner: build.mutation<PartnerSettlement, { storeId: string; partnerId: string; input: SettlePartnerInput }>({
      query: ({ storeId, partnerId, input }) => ({
        url: `stores/${storeId}/partners/${partnerId}/settlements`,
        method: "POST",
        body: input,
      }),
      invalidatesTags: (_res, _err, { storeId }) => [salesTag(storeId)],
    }),
    undoPartnerSettlement: build.mutation<void, { storeId: string; partnerId: string; settlementId: string }>({
      query: ({ storeId, partnerId, settlementId }) => ({
        url: `stores/${storeId}/partners/${partnerId}/settlements/${settlementId}`,
        method: "DELETE",
      }),
      invalidatesTags: (_res, _err, { storeId }) => [salesTag(storeId)],
    }),

    getCancelRequests: build.query<PendingCancelRequest[], string>({
      query: (storeId) => `stores/${storeId}/cancel-requests`,
      providesTags: (_res, _err, storeId) => [requestsTag(storeId)],
    }),
    decideCancelRequest: build.mutation<
      unknown,
      { storeId: string; orderId: string; requestId: number; approve: boolean; note?: string | null }
    >({
      query: ({ storeId, orderId, requestId, approve, note }) => ({
        url: `stores/${storeId}/orders/${orderId}/cancel-requests/${requestId}/${approve ? "approve" : "reject"}`,
        method: "POST",
        body: { note: note || null },
      }),
      invalidatesTags: (_res, _err, { storeId, orderId }) => [
        requestsTag(storeId),
        ordersTag(storeId),
        { type: "Order" as const, id: orderId },
        { type: "Kitchen" as const, id: storeId },
        salesTag(storeId),
      ],
    }),
  }),
});

export const {
  useGetPartnersQuery,
  useCreatePartnerMutation,
  useUpdatePartnerMutation,
  usePausePartnerMutation,
  useSetPartnerCatalogMutation,
  useGetPartnersPageQuery,
  useGetPartnerQuery,
  useGetPartnerStatsQuery,
  useGetPartnerSalesQuery,
  useGetPartnerSettlementsQuery,
  useSettlePartnerMutation,
  useUndoPartnerSettlementMutation,
  useGetCancelRequestsQuery,
  useDecideCancelRequestMutation,
} = partnersApi;
