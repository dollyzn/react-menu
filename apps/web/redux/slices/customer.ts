import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type RecentOrder = {
  publicToken: string;
  storeSlug: string;
  storeName: string;
  number: number;
  total: number;
  createdAt: string;
};

/**
 * Menu customer identity (anota.ai style): just name and phone, remembered
 * on this device. Not a staff account. `tokens` (per store slug) are the
 * history sessions of the phone the customer proved by WhatsApp (ADR 0025;
 * `cs_…`). Tokens of the older device link (`ct_…`) no longer open anything.
 */
interface CustomerState {
  name: string;
  phone: string;
  /** For online payments only (the gateway's receipt); optional. */
  email?: string;
  recentOrders: RecentOrder[];
  tokens?: Record<string, string>;
  /** The last answer to "Receber avisos pelo WhatsApp". */
  whatsappOptIn?: boolean;
}

const initialState: CustomerState = { name: "", phone: "", recentOrders: [], tokens: {} };

const customerSlice = createSlice({
  name: "customer",
  initialState,
  reducers: {
    rememberCustomer(state, action: PayloadAction<{ name: string; phone: string }>) {
      state.name = action.payload.name;
      state.phone = action.payload.phone;
    },
    rememberEmail(state, action: PayloadAction<string>) {
      state.email = action.payload;
    },
    rememberWhatsAppOptIn(state, action: PayloadAction<boolean>) {
      state.whatsappOptIn = action.payload;
    },
    addRecentOrder(state, action: PayloadAction<RecentOrder>) {
      state.recentOrders = [
        action.payload,
        ...state.recentOrders.filter((o) => o.publicToken !== action.payload.publicToken),
      ].slice(0, 10);
    },
    /** The history session of a verified phone in one store. */
    linkStore(state, action: PayloadAction<{ storeSlug: string; token: string }>) {
      state.tokens = { ...state.tokens, [action.payload.storeSlug]: action.payload.token };
    },
    unlinkStore(state, action: PayloadAction<string>) {
      const tokens = { ...state.tokens };
      delete tokens[action.payload];
      state.tokens = tokens;
    },
    forgetCustomer() {
      return initialState;
    },
  },
});

export const {
  rememberCustomer,
  rememberEmail,
  rememberWhatsAppOptIn,
  addRecentOrder,
  linkStore,
  unlinkStore,
  forgetCustomer,
} = customerSlice.actions;
export default customerSlice.reducer;
