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
 * on this device. Not a staff account. `tokens` (per store slug) link this
 * device to the customer's whole order history (see CustomerAccessService).
 */
interface CustomerState {
  name: string;
  phone: string;
  /** For online payments only (the gateway's receipt); optional. */
  email?: string;
  recentOrders: RecentOrder[];
  tokens?: Record<string, string>;
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
    addRecentOrder(state, action: PayloadAction<RecentOrder>) {
      state.recentOrders = [
        action.payload,
        ...state.recentOrders.filter((o) => o.publicToken !== action.payload.publicToken),
      ].slice(0, 10);
    },
    /** Links this device to a customer's history in one store. */
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

export const { rememberCustomer, rememberEmail, addRecentOrder, linkStore, unlinkStore, forgetCustomer } =
  customerSlice.actions;
export default customerSlice.reducer;
