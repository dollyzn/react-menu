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

/**
 * Whose charges: the store's POS (default) or the partner area (ADR 0024),
 * which charges the partner's orders on the partner's machine.
 */
export type PointArea = "store" | "partner";
const ordersPath = (storeId: string, area?: PointArea) =>
  `stores/${storeId}${area === "partner" ? "/partner" : ""}/orders`;
const chargesTag = (storeId: string, area?: PointArea) => ({
  type: "PointConfig" as const,
  id: `charges-${area === "partner" ? "partner-" : ""}${storeId}`,
});

type ChargeArg = { storeId: string; orderId: string; paymentId: string; area?: PointArea };

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
    /**
     * Each change sends the whole setting: the screen updates at once (the
     * next change builds on it, not on a stale copy) and goes back if it fails.
     */
    updatePointSettings: build.mutation<PointConfig, { storeId: string; input: PointSettingsInput }>({
      query: ({ storeId, input }) => ({ url: `stores/${storeId}/point/settings`, method: "PUT", body: input }),
      async onQueryStarted({ storeId, input }, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          pointApi.util.updateQueryData("getPointConfig", storeId, (draft) => {
            Object.assign(draft, input);
          })
        );
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
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
    /** Lends a machine to a partner (ADR 0024), or gives it back (`partnerId: null`). */
    assignPointTerminal: build.mutation<void, { storeId: string; terminalId: string; partnerId: string | null }>({
      query: ({ storeId, terminalId, partnerId }) => ({
        url: `stores/${storeId}/point/terminals/${encodeURIComponent(terminalId)}/partner`,
        method: "PUT",
        body: { partnerId },
      }),
      invalidatesTags: (_res, _err, { storeId }) => [
        configTag(storeId),
        terminalsTag(storeId),
        { type: "Partner" as const, id: `list-${storeId}` },
      ],
    }),

    /** Sends the order's total to a machine. */
    chargeOnPoint: build.mutation<
      PointCharge,
      { storeId: string; orderId: string; input: PointChargeInput; idempotencyKey: string; area?: PointArea }
    >({
      query: ({ storeId, orderId, input, idempotencyKey, area }) => ({
        url: `${ordersPath(storeId, area)}/${orderId}/point-charges`,
        method: "POST",
        body: input,
        headers: { [IDEMPOTENCY_HEADER]: idempotencyKey },
      }),
      invalidatesTags: (_res, _err, { storeId, area }) => [chargesTag(storeId, area)],
      extraOptions: { quiet: true },
    }),
    /** Charges waiting on the store's machines; `check` asks Mercado Pago about each. */
    getPendingPointCharges: build.query<PointCharge[], { storeId: string; check?: boolean; area?: PointArea }>({
      query: ({ storeId, check, area }) =>
        `stores/${storeId}${area === "partner" ? "/partner" : ""}/point/charges${check ? "?check=1" : ""}`,
      providesTags: (_res, _err, { storeId, area }) => [chargesTag(storeId, area)],
      extraOptions: { quiet: true, background: true },
    }),
    /** The charge while it waits; `check` also asks Mercado Pago. */
    getPointCharge: build.query<PointCharge, ChargeArg & { check?: boolean }>({
      query: ({ storeId, orderId, paymentId, check, area }) =>
        `${ordersPath(storeId, area)}/${orderId}/point-charges/${paymentId}${check ? "?check=1" : ""}`,
      // Followed by polling: an answer never stays cached for later.
      keepUnusedDataFor: 0,
      extraOptions: { quiet: true, background: true },
    }),
    cancelPointCharge: build.mutation<PointCharge, ChargeArg>({
      query: ({ storeId, orderId, paymentId, area }) => ({
        url: `${ordersPath(storeId, area)}/${orderId}/point-charges/${paymentId}/cancel`,
        method: "POST",
      }),
      invalidatesTags: (_res, _err, { storeId, area }) => [chargesTag(storeId, area)],
      extraOptions: { quiet: true },
    }),
    simulatePointCharge: build.mutation<PointCharge, ChargeArg & { approve: boolean }>({
      query: ({ storeId, orderId, paymentId, approve, area }) => ({
        url: `${ordersPath(storeId, area)}/${orderId}/point-charges/${paymentId}/simulate`,
        method: "POST",
        body: { approve },
      }),
      invalidatesTags: (_res, _err, { storeId, orderId, area }) => [
        ordersTag(storeId),
        orderTag(orderId),
        chargesTag(storeId, area),
        { type: "Partner" as const, id: `orders-${storeId}` },
      ],
    }),
  }),
});

export const {
  useGetPointConfigQuery,
  useGetPointTerminalsQuery,
  useUpdatePointSettingsMutation,
  useEnablePointTerminalMutation,
  useDisablePointTerminalMutation,
  useAssignPointTerminalMutation,
  useChargeOnPointMutation,
  useLazyGetPointChargeQuery,
  useGetPendingPointChargesQuery,
  useCancelPointChargeMutation,
  useSimulatePointChargeMutation,
} = pointApi;
