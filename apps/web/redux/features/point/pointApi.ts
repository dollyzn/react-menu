import { baseApi } from "@/redux/api/baseApi";
import { IDEMPOTENCY_HEADER } from "@/lib/idempotency";
import type {
  PointCharge,
  PointChargeInput,
  PointConfig,
  PointSettingsInput,
  PointTerminalListing,
} from "@react-menu/contracts";

const configTag = (storeId: string) => ({ type: "PointConfig" as const, id: storeId });
const terminalsTag = (storeId: string) => ({ type: "PointConfig" as const, id: `terminals-${storeId}` });
const ordersTag = (storeId: string) => ({ type: "Order" as const, id: `store-${storeId}` });
const orderTag = (orderId: string) => ({ type: "Order" as const, id: orderId });

type ChargeArg = { storeId: string; orderId: string; paymentId: string };

/** Mercado Pago Point card machines (ADR 0020). */
export const pointApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    /** What the POS needs: the machines on and how they charge. */
    getPointConfig: build.query<PointConfig, string>({
      query: (storeId) => `stores/${storeId}/point`,
      providesTags: (_res, _err, storeId) => [configTag(storeId)],
    }),
    /** Every machine of the Mercado Pago account (managers). */
    getPointTerminals: build.query<PointTerminalListing[], string>({
      query: (storeId) => `stores/${storeId}/point/terminals`,
      providesTags: (_res, _err, storeId) => [terminalsTag(storeId)],
      extraOptions: { quiet: true },
    }),
    updatePointSettings: build.mutation<PointConfig, { storeId: string; input: PointSettingsInput }>({
      query: ({ storeId, input }) => ({ url: `stores/${storeId}/point/settings`, method: "PUT", body: input }),
      invalidatesTags: (_res, _err, { storeId }) => [configTag(storeId)],
    }),
    enablePointTerminal: build.mutation<PointConfig, { storeId: string; terminalId: string; name: string }>({
      query: ({ storeId, terminalId, name }) => ({
        url: `stores/${storeId}/point/terminals`,
        method: "POST",
        body: { terminalId, name },
      }),
      invalidatesTags: (_res, _err, { storeId }) => [configTag(storeId), terminalsTag(storeId)],
    }),
    disablePointTerminal: build.mutation<void, { storeId: string; terminalId: string }>({
      query: ({ storeId, terminalId }) => ({
        url: `stores/${storeId}/point/terminals/${encodeURIComponent(terminalId)}`,
        method: "DELETE",
      }),
      invalidatesTags: (_res, _err, { storeId }) => [configTag(storeId), terminalsTag(storeId)],
    }),

    /** Sends the order's total to a machine. */
    chargeOnPoint: build.mutation<
      PointCharge,
      { storeId: string; orderId: string; input: PointChargeInput; idempotencyKey: string }
    >({
      query: ({ storeId, orderId, input, idempotencyKey }) => ({
        url: `stores/${storeId}/orders/${orderId}/point-charges`,
        method: "POST",
        body: input,
        headers: { [IDEMPOTENCY_HEADER]: idempotencyKey },
      }),
      extraOptions: { quiet: true },
    }),
    /** The charge while it waits; `check` also asks Mercado Pago. */
    getPointCharge: build.query<PointCharge, ChargeArg & { check?: boolean }>({
      query: ({ storeId, orderId, paymentId, check }) =>
        `stores/${storeId}/orders/${orderId}/point-charges/${paymentId}${check ? "?check=1" : ""}`,
      // Followed by polling: an answer never stays cached for later.
      keepUnusedDataFor: 0,
      extraOptions: { quiet: true, background: true },
    }),
    cancelPointCharge: build.mutation<PointCharge, ChargeArg>({
      query: ({ storeId, orderId, paymentId }) => ({
        url: `stores/${storeId}/orders/${orderId}/point-charges/${paymentId}/cancel`,
        method: "POST",
      }),
      extraOptions: { quiet: true },
    }),
    simulatePointCharge: build.mutation<PointCharge, ChargeArg & { approve: boolean }>({
      query: ({ storeId, orderId, paymentId, approve }) => ({
        url: `stores/${storeId}/orders/${orderId}/point-charges/${paymentId}/simulate`,
        method: "POST",
        body: { approve },
      }),
      invalidatesTags: (_res, _err, { storeId, orderId }) => [ordersTag(storeId), orderTag(orderId)],
    }),
  }),
});

export const {
  useGetPointConfigQuery,
  useGetPointTerminalsQuery,
  useUpdatePointSettingsMutation,
  useEnablePointTerminalMutation,
  useDisablePointTerminalMutation,
  useChargeOnPointMutation,
  useLazyGetPointChargeQuery,
  useCancelPointChargeMutation,
  useSimulatePointChargeMutation,
} = pointApi;
