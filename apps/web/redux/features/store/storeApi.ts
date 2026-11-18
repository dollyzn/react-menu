import type { OpeningInterval } from "@react-menu/contracts";
import { baseApi } from "@/redux/api/baseApi";

const storeTag = (id: string) => ({ type: "Store" as const, id });

export const storeApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getStoreById: build.query<Store, string>({
      query: (id) => `stores/${id}`,
      providesTags: (_res, _err, id) => [storeTag(id)],
    }),

    createStore: build.mutation<Store, { name: string; slug: string }>({
      query: (data) => ({
        url: "stores",
        method: "POST",
        body: data,
      }),
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
      // The store page shows the error in its forms.
      extraOptions: { quiet: true },
      // Kitchen batching changes the kitchen queue too; the rest doesn't.
      invalidatesTags: (_res, _err, { id, data }) =>
        data.kitchenBatchLookahead === undefined ? [storeTag(id)] : [storeTag(id), { type: "Kitchen", id }],
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

    /** Weekly schedule; with scheduleEnabled the store opens and closes by itself. */
    updateStoreHours: build.mutation<
      Store,
      { id: string; scheduleEnabled: boolean; openingHours: OpeningInterval[] }
    >({
      query: ({ id, ...body }) => ({ url: `stores/${id}/hours`, method: "PUT", body }),
      extraOptions: { quiet: true },
      invalidatesTags: (_res, _err, { id }) => [storeTag(id)],
    }),

    /** Set or clear (null) the store's Mercado Pago credentials. */
    updatePaymentSettings: build.mutation<
      Pick<
        Store,
        | "mercadoPagoEnabled"
        | "mercadoPagoPublicKey"
        | "maxInstallments"
        | "cardFeeEnabled"
        | "cardCreditFeePercent"
        | "cardDebitFeePercent"
      >,
      {
        id: string;
        data: {
          mercadoPagoAccessToken?: string | null;
          mercadoPagoWebhookSecret?: string | null;
          mercadoPagoPublicKey?: string | null;
          maxInstallments?: number;
          cardFeeEnabled?: boolean;
          cardCreditFeePercent?: number;
          cardDebitFeePercent?: number;
        };
      }
    >({
      query: ({ id, data }) => ({ url: `stores/${id}/payment-settings`, method: "PUT", body: data }),
      invalidatesTags: (_res, _err, { id }) => [storeTag(id)],
    }),
  }),
});

export const {
  useGetStoreByIdQuery,
  useLazyGetStoreByIdQuery,
  useCreateStoreMutation,
  useUpdateStoreMutation,
  useUpdateStoreImagesMutation,
  useUpdateStoreStatusMutation,
  useUpdateStoreHoursMutation,
  useUpdatePaymentSettingsMutation,
} = storeApi;
