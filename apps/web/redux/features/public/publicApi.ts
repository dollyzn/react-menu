import { baseApi } from "@/redux/api/baseApi";
import { IDEMPOTENCY_HEADER } from "@/lib/idempotency";
import type {
  CreatePublicOrderInput,
  CustomerLoginChallenge,
  CustomerLoginClaim,
  CustomerLoginStartInput,
  CustomerOrders,
  PlacedPublicOrder,
  PublicMenu,
  PublicOrder,
  PublicOrderSummary,
  PublicPaymentRequest,
} from "@react-menu/contracts";

/** Header with the history session of a verified phone (see customer slice, ADR 0025). */
const CUSTOMER_TOKEN_HEADER = "Customer-Token";

/** Customer-facing endpoints (no login). */
export const publicApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    /** `preview` is for staff screens: the visit is not counted. */
    getPublicMenu: build.query<PublicMenu, { slug?: string; preview?: boolean }>({
      query: ({ slug, preview }) =>
        `${slug ? `public/menu/${slug}` : "public/menu"}${preview ? "?preview=1" : ""}`,
      // The POS reads this: editing items (e.g. "esgotar") refreshes it.
      providesTags: [{ type: "Item", id: "PUBLIC_MENU" }],
    }),

    /** `idempotencyKey`: keep it across taps/reloads so a lost response never duplicates the order. */
    placeOrder: build.mutation<
      PlacedPublicOrder,
      { slug: string; input: CreatePublicOrderInput; idempotencyKey: string }
    >({
      query: ({ slug, input, idempotencyKey }) => ({
        url: `public/menu/${slug}/orders`,
        method: "POST",
        body: input,
        headers: { [IDEMPOTENCY_HEADER]: idempotencyKey },
      }),
      invalidatesTags: [{ type: "PublicOrder", id: "HISTORY" }],
    }),

    /** Every order of the verified phone behind the session, in one store. */
    getMyOrders: build.query<CustomerOrders, { slug: string; token: string }>({
      query: ({ slug, token }) => ({
        url: `public/menu/${slug}/my-orders`,
        headers: { [CUSTOMER_TOKEN_HEADER]: token },
      }),
      providesTags: [{ type: "PublicOrder", id: "HISTORY" }],
    }),

    /**
     * The customer's history on this device: orders placed here (by public
     * token) plus, for stores where the phone was verified, every order of
     * that phone. Sessions the API no longer accepts come back in `staleLinks`.
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

    /**
     * History sign-in by WhatsApp: `message` gives a code and a wa.me link,
     * `code` sends one to the phone. Errors are shown by the form itself.
     */
    startCustomerLogin: build.mutation<CustomerLoginChallenge, { slug: string; input: CustomerLoginStartInput }>({
      query: ({ slug, input }) => ({ url: `public/menu/${slug}/customer-login`, method: "POST", body: input }),
      extraOptions: { quiet: true },
    }),
    /** Pending until the message arrives (polled) or with the code typed; then the session, once. */
    claimCustomerLogin: build.mutation<
      CustomerLoginClaim,
      { slug: string; id: string; secret: string; code?: string }
    >({
      query: ({ slug, id, secret, code }) => ({
        url: `public/menu/${slug}/customer-login/${id}`,
        method: "POST",
        body: { secret, ...(code && { code }) },
      }),
      extraOptions: { quiet: true },
    }),
    /**
     * The same claim, asked every few seconds while the customer sends the
     * message: in the background, so it never holds a reload or a link.
     */
    pollCustomerLogin: build.mutation<CustomerLoginClaim, { slug: string; id: string; secret: string }>({
      query: ({ slug, id, secret }) => ({
        url: `public/menu/${slug}/customer-login/${id}`,
        method: "POST",
        body: { secret },
      }),
      extraOptions: { quiet: true, background: true },
    }),
    /** "Sair" on the history: ends the session (the slice forgets it either way). */
    signOutCustomer: build.mutation<void, { slug: string; token: string }>({
      query: ({ slug, token }) => ({
        url: `public/menu/${slug}/customer-session`,
        method: "DELETE",
        headers: { [CUSTOMER_TOKEN_HEADER]: token },
      }),
      extraOptions: { quiet: true, background: true },
      invalidatesTags: [{ type: "PublicOrder", id: "HISTORY" }],
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

    /** Pix QR code or a tokenized card for an order waiting for payment. */
    payOrder: build.mutation<
      PublicOrder,
      { token: string; input: PublicPaymentRequest; idempotencyKey: string }
    >({
      query: ({ token, input, idempotencyKey }) => ({
        url: `public/orders/${token}/payments`,
        method: "POST",
        body: input,
        headers: { [IDEMPOTENCY_HEADER]: idempotencyKey },
      }),
      // The response is the updated order: no refetch needed.
      async onQueryStarted({ token }, { dispatch, queryFulfilled }) {
        const { data } = await queryFulfilled;
        dispatch(publicApi.util.upsertQueryData("getPublicOrder", token, data));
      },
    }),

    /**
     * "Avise quando ficar pronto": web push to this browser (its Firebase
     * Installation ID). Push registrations nobody waits for: `background`,
     * so they never hold a navigation.
     */
    subscribeOrderReady: build.mutation<void, { token: string; fid: string }>({
      query: ({ token, fid }) => ({ url: `public/orders/${token}/push`, method: "POST", body: { fid } }),
      extraOptions: { quiet: true, background: true },
    }),
    unsubscribeOrderReady: build.mutation<void, { token: string; fid: string }>({
      query: ({ token, fid }) => ({ url: `public/orders/${token}/push`, method: "DELETE", body: { fid } }),
      extraOptions: { quiet: true, background: true },
    }),
    /** After the bank's 3-D Secure challenge: the API reads the attempt from the gateway now. */
    syncPayment: build.mutation<PublicOrder, string>({
      query: (token) => ({ url: `public/orders/${token}/payments/sync`, method: "POST" }),
      extraOptions: { quiet: true },
      async onQueryStarted(token, { dispatch, queryFulfilled }) {
        const { data } = await queryFulfilled;
        dispatch(publicApi.util.upsertQueryData("getPublicOrder", token, data));
      },
    }),

    /** Development fake gateway only: approves the pending Pix. */
    simulatePayment: build.mutation<PublicOrder, string>({
      query: (token) => ({ url: `public/orders/${token}/payments/simulate`, method: "POST" }),
      async onQueryStarted(token, { dispatch, queryFulfilled }) {
        const { data } = await queryFulfilled;
        dispatch(publicApi.util.upsertQueryData("getPublicOrder", token, data));
      },
    }),
  }),
});

export const {
  useGetPublicMenuQuery,
  usePlaceOrderMutation,
  useGetPublicOrderQuery,
  usePayOrderMutation,
  useSimulatePaymentMutation,
  useSyncPaymentMutation,
  useSubscribeOrderReadyMutation,
  useUnsubscribeOrderReadyMutation,
  useGetMyOrdersQuery,
  useLookupOrdersQuery,
  useGetOrderHistoryQuery,
  useStartCustomerLoginMutation,
  useClaimCustomerLoginMutation,
  usePollCustomerLoginMutation,
  useSignOutCustomerMutation,
} = publicApi;
