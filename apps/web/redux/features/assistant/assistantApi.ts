import type {
  AssistantConversationDetail,
  AssistantCosts,
  AssistantConversationSummary,
  AssistantModelOption,
  AssistantModelsInput,
  AssistantSettings,
  AssistantSettingsInput,
  AssistantStatus,
} from "@react-menu/contracts";
import { baseApi } from "@/redux/api/baseApi";

const statusTag = (storeId: string) => ({ type: "Assistant" as const, id: `status-${storeId}` });
const listTag = (storeId: string) => ({ type: "Assistant" as const, id: `list-${storeId}` });

/** The store assistant: its status, your conversations and (managers) its model. */
export const assistantApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getAssistantStatus: build.query<AssistantStatus, string>({
      query: (storeId) => `stores/${storeId}/assistant`,
      providesTags: (_res, _err, storeId) => [statusTag(storeId)],
    }),
    /** Estimated US$ today and this month (managers). */
    getAssistantCosts: build.query<AssistantCosts, string>({
      query: (storeId) => `stores/${storeId}/assistant-costs`,
      providesTags: (_res, _err, storeId) => [statusTag(storeId)],
    }),
    getAssistantConversations: build.query<AssistantConversationSummary[], string>({
      query: (storeId) => `stores/${storeId}/assistant/conversations`,
      providesTags: (_res, _err, storeId) => [listTag(storeId)],
    }),
    getAssistantConversation: build.query<AssistantConversationDetail, { storeId: string; id: string }>({
      query: ({ storeId, id }) => `stores/${storeId}/assistant/conversations/${id}`,
      // Always the saved version: the chat itself holds the live one.
      keepUnusedDataFor: 0,
    }),
    deleteAssistantConversation: build.mutation<void, { storeId: string; id: string }>({
      query: ({ storeId, id }) => ({ url: `stores/${storeId}/assistant/conversations/${id}`, method: "DELETE" }),
      invalidatesTags: (_res, _err, { storeId }) => [listTag(storeId)],
    }),
    updateAssistantSettings: build.mutation<
      AssistantSettings,
      { storeId: string; data: AssistantSettingsInput }
    >({
      query: ({ storeId, data }) => ({ url: `stores/${storeId}/assistant-settings`, method: "PUT", body: data }),
      invalidatesTags: (_res, _err, { storeId }) => [{ type: "Store", id: storeId }, statusTag(storeId)],
    }),
    /** The chat models of a key (a POST: the key goes in the body, never in a URL). */
    listAssistantModels: build.mutation<AssistantModelOption[], { storeId: string; data: AssistantModelsInput }>({
      query: ({ storeId, data }) => ({ url: `stores/${storeId}/assistant-settings/models`, method: "POST", body: data }),
      // The field shows the error itself.
      extraOptions: { quiet: true, background: true },
    }),
  }),
});

/** After an answer: today's count and the conversation list changed. */
export const assistantTagsAfterAnswer = (storeId: string) => [statusTag(storeId), listTag(storeId)];

export const {
  useGetAssistantStatusQuery,
  useGetAssistantConversationsQuery,
  useGetAssistantCostsQuery,
  useLazyGetAssistantConversationQuery,
  useDeleteAssistantConversationMutation,
  useUpdateAssistantSettingsMutation,
  useListAssistantModelsMutation,
} = assistantApi;
