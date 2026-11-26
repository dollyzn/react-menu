import { baseApi } from "@/redux/api/baseApi";
import type {
  WhatsAppConnectInput,
  WhatsAppConnection,
  WhatsAppMessageLog,
  WhatsAppSettingsInput,
} from "@react-menu/contracts";

const tag = (storeId: string) => ({ type: "WhatsApp" as const, id: storeId });
const messagesTag = (storeId: string) => ({ type: "WhatsApp" as const, id: `messages-${storeId}` });

/** The store's WhatsApp number (ADR 0025): managers only. */
export const whatsappApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getWhatsApp: build.query<WhatsAppConnection, string>({
      query: (storeId) => `stores/${storeId}/whatsapp`,
      providesTags: (_res, _err, storeId) => [tag(storeId)],
    }),
    /** Embedded Signup finished (or the development fake): the answer is the new state. */
    connectWhatsApp: build.mutation<WhatsAppConnection, { storeId: string; input: WhatsAppConnectInput }>({
      query: ({ storeId, input }) => ({ url: `stores/${storeId}/whatsapp`, method: "POST", body: input }),
      async onQueryStarted({ storeId }, { dispatch, queryFulfilled }) {
        const { data } = await queryFulfilled;
        dispatch(whatsappApi.util.upsertQueryData("getWhatsApp", storeId, data));
      },
    }),
    /** The number and templates read again from Meta, the webhook override applied again. */
    refreshWhatsApp: build.mutation<WhatsAppConnection, string>({
      query: (storeId) => ({ url: `stores/${storeId}/whatsapp/refresh`, method: "POST" }),
      async onQueryStarted(storeId, { dispatch, queryFulfilled }) {
        const { data } = await queryFulfilled;
        dispatch(whatsappApi.util.upsertQueryData("getWhatsApp", storeId, data));
      },
    }),
    /** A switch flips at once and goes back if the API refuses. */
    updateWhatsAppSettings: build.mutation<WhatsAppConnection, { storeId: string; input: WhatsAppSettingsInput }>({
      query: ({ storeId, input }) => ({ url: `stores/${storeId}/whatsapp/settings`, method: "PUT", body: input }),
      async onQueryStarted({ storeId, input }, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          whatsappApi.util.updateQueryData("getWhatsApp", storeId, (draft) => {
            if (draft.account) Object.assign(draft.account, input);
          })
        );
        try {
          const { data } = await queryFulfilled;
          dispatch(whatsappApi.util.upsertQueryData("getWhatsApp", storeId, data));
        } catch {
          patch.undo();
        }
      },
    }),
    disconnectWhatsApp: build.mutation<void, string>({
      query: (storeId) => ({ url: `stores/${storeId}/whatsapp`, method: "DELETE" }),
      invalidatesTags: (_res, _err, storeId) => [tag(storeId), messagesTag(storeId)],
    }),
    getWhatsAppMessages: build.query<WhatsAppMessageLog[], string>({
      query: (storeId) => `stores/${storeId}/whatsapp/messages`,
      providesTags: (_res, _err, storeId) => [messagesTag(storeId)],
      extraOptions: { quiet: true },
    }),
  }),
});

export const {
  useGetWhatsAppQuery,
  useConnectWhatsAppMutation,
  useRefreshWhatsAppMutation,
  useUpdateWhatsAppSettingsMutation,
  useDisconnectWhatsAppMutation,
  useGetWhatsAppMessagesQuery,
} = whatsappApi;
