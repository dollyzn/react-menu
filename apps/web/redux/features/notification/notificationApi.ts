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
      extraOptions: { background: true },
      invalidatesTags: [listTag],
    }),

    markAllNotificationsAsRead: build.mutation<void, void>({
      query: () => ({ url: "notifications/read-all", method: "POST" }),
      extraOptions: { background: true },
      invalidatesTags: [listTag],
    }),

    deleteNotification: build.mutation<void, string>({
      query: (id) => ({ url: `notifications/${id}`, method: "DELETE" }),
      invalidatesTags: [listTag],
    }),

    registerPush: build.mutation<void, { fid: string }>({
      query: (body) => ({ url: "notifications/push/register", method: "POST", body }),
      extraOptions: { background: true },
    }),

    unregisterPush: build.mutation<void, { fid: string }>({
      query: (body) => ({ url: "notifications/push/unregister", method: "POST", body }),
      extraOptions: { background: true },
    }),

    checkPush: build.mutation<{ registered: boolean }, { fid: string }>({
      query: (body) => ({ url: "notifications/push/check", method: "POST", body }),
      extraOptions: { background: true },
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
