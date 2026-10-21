import { baseApi } from "@/redux/api/baseApi";
import { IDEMPOTENCY_HEADER } from "@/lib/idempotency";
import type {
  CreatePublicOrderInput,
  CustomerOrders,
  PlacedPublicOrder,
  PublicMenu,
  PublicOrder,
  PublicOrderSummary,
} from "@react-menu/contracts";

/** Header with the device's order-history token (see customer slice). */
const CUSTOMER_TOKEN_HEADER = "Customer-Token";

/** Customer-facing endpoints (no login). */
export const publicApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    /** `preview` is for staff screens: the visit is not counted. */
    getPublicMenu: build.query<PublicMenu, { slug?: string; preview?: boolean }>({
      query: ({ slug, preview }) =>
        `${slug ? `public/menu/${slug}` : "public/menu"}${preview ? "?preview=1" : ""}`,
    }),

    /** `idempotencyKey`: keep it across taps/reloads so a lost response never duplicates the order. */
    placeOrder: build.mutation<
      PlacedPublicOrder,
      { slug: string; input: CreatePublicOrderInput; idempotencyKey: string; customerToken?: string }
    >({
      query: ({ slug, input, idempotencyKey, customerToken }) => ({
        url: `public/menu/${slug}/orders`,
        method: "POST",
        body: input,
        headers: {
          [IDEMPOTENCY_HEADER]: idempotencyKey,
          ...(customerToken ? { [CUSTOMER_TOKEN_HEADER]: customerToken } : {}),
        },
      }),
      invalidatesTags: [{ type: "PublicOrder", id: "HISTORY" }],
    }),

    /** All orders of the customer this device is linked to, in one store. */
    getMyOrders: build.query<CustomerOrders, { slug: string; token: string }>({
      query: ({ slug, token }) => ({
        url: `public/menu/${slug}/my-orders`,
        headers: { [CUSTOMER_TOKEN_HEADER]: token },
      }),
      providesTags: [{ type: "PublicOrder", id: "HISTORY" }],
    }),

    /**
     * The customer's history on this device: orders placed here (by public
     * token) plus, for linked stores, every order of that customer. Links
     * the API no longer accepts come back in `staleLinks`.
     */
    getOrderHistory: build.query<
      { orders: PublicOrderSummary[]; customers: (CustomerOrders["customer"] & { storeSlug: string })[]; staleLinks: string[] },
      { tokens: string[]; links: { storeSlug: string; token: string }[] }
    >({
      async queryFn({ tokens, links }, _api, _extra, baseQuery) {
        const orders = new Map<string, PublicOrderSummary>();
        const customers: (CustomerOrders["customer"] & { storeSlug: string })[] = [];
        const staleLinks: string[] = [];

        if (tokens.length > 0) {
          const local = await baseQuery(`public/orders?tokens=${tokens.slice(0, 30).join(",")}`);
          if (local.error) return { error: local.error };
          for (const order of local.data as PublicOrderSummary[]) orders.set(order.publicToken, order);
        }
        for (const link of links) {
          const linked = await baseQuery({
            url: `public/menu/${link.storeSlug}/my-orders`,
            headers: { [CUSTOMER_TOKEN_HEADER]: link.token },
          });
          if (linked.error) {
            if (linked.error.status === 401) staleLinks.push(link.storeSlug);
            continue;
          }
          const data = linked.data as CustomerOrders;
          customers.push({ ...data.customer, storeSlug: link.storeSlug });
          for (const order of data.orders) orders.set(order.publicToken, order);
        }

        const sorted = [...orders.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        return { data: { orders: sorted, customers, staleLinks } };
      },
      providesTags: [{ type: "PublicOrder", id: "HISTORY" }],
    }),

    /** Live status of the orders placed on this device. */
    lookupOrders: build.query<PublicOrderSummary[], string[]>({
      query: (tokens) => `public/orders?tokens=${tokens.join(",")}`,
      providesTags: [{ type: "PublicOrder", id: "HISTORY" }],
    }),

    getPublicOrder: build.query<PublicOrder, string>({
      query: (token) => `public/orders/${token}`,
      providesTags: (_res, _err, token) => [{ type: "PublicOrder", id: token }],
    }),
  }),
});

export const {
  useGetPublicMenuQuery,
  usePlaceOrderMutation,
  useGetPublicOrderQuery,
  useGetMyOrdersQuery,
  useLookupOrdersQuery,
  useGetOrderHistoryQuery,
} = publicApi;
