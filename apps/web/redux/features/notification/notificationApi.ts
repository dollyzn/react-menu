import { baseApi } from "@/redux/api/baseApi";
import type { NotificationList } from "@/types/notification";

const listTag = { type: "Notification" as const, id: "LIST" };

export const notificationApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getNotifications: build.query<NotificationList, { perPage?: number } | void>({
      query: (arg) => `notifications?perPage=${arg?.perPage ?? 30}`,
      providesTags: [listTag],
    }),

    markNotificationAsRead: build.mutation<void, string>({
      query: (id) => ({ url: `notifications/${id}/read`, method: "PATCH" }),
      invalidatesTags: [listTag],
    }),

    markAllNotificationsAsRead: build.mutation<void, void>({
      query: () => ({ url: "notifications/read-all", method: "POST" }),
      invalidatesTags: [listTag],
    }),

    deleteNotification: build.mutation<void, string>({
      query: (id) => ({ url: `notifications/${id}`, method: "DELETE" }),
      invalidatesTags: [listTag],
    }),

    clearNotifications: build.mutation<void, void>({
      query: () => ({ url: "notifications", method: "DELETE" }),
      invalidatesTags: [listTag],
    }),
  }),
});

export const {
  useGetNotificationsQuery,
  useMarkNotificationAsReadMutation,
  useMarkAllNotificationsAsReadMutation,
  useDeleteNotificationMutation,
  useClearNotificationsMutation,
} = notificationApi;
