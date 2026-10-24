import type { DashboardToday, SalesReport } from "@react-menu/contracts";
import { baseApi } from "@/redux/api/baseApi";

export type ReportPeriodArg = { storeId: string; from: string; to: string };

/** Sales reports and the live overview (managers). */
export const reportApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getSalesReport: build.query<SalesReport, ReportPeriodArg>({
      query: ({ storeId, from, to }) => ({ url: `stores/${storeId}/reports/sales`, params: { from, to } }),
      keepUnusedDataFor: 30,
    }),
    // Live: realtime order events invalidate the store's Order tag.
    getDashboardToday: build.query<DashboardToday, string>({
      query: (storeId) => `stores/${storeId}/dashboard/today`,
      providesTags: (_res, _err, storeId) => [
        { type: "Order", id: `store-${storeId}` },
        { type: "Ingredient", id: `store-${storeId}` },
        { type: "Store", id: storeId },
      ],
    }),
  }),
});

export const { useGetSalesReportQuery, useGetDashboardTodayQuery } = reportApi;
