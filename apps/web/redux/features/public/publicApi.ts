import { baseApi } from "@/redux/api/baseApi";
import { IDEMPOTENCY_HEADER } from "@/lib/idempotency";
import type {
  CreatePublicOrderInput,
  PublicMenu,
  PublicOrder,
} from "@react-menu/contracts";

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
      PublicOrder,
      { slug: string; input: CreatePublicOrderInput; idempotencyKey: string }
    >({
      query: ({ slug, input, idempotencyKey }) => ({
        url: `public/menu/${slug}/orders`,
        method: "POST",
        body: input,
        headers: { [IDEMPOTENCY_HEADER]: idempotencyKey },
      }),
    }),

    getPublicOrder: build.query<PublicOrder, string>({
      query: (token) => `public/orders/${token}`,
      providesTags: (_res, _err, token) => [{ type: "PublicOrder", id: token }],
    }),
  }),
});

export const { useGetPublicMenuQuery, usePlaceOrderMutation, useGetPublicOrderQuery } = publicApi;
