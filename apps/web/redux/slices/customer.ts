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
 * on this device. Not a staff account.
 */
interface CustomerState {
  name: string;
  phone: string;
  recentOrders: RecentOrder[];
}

const initialState: CustomerState = { name: "", phone: "", recentOrders: [] };

const customerSlice = createSlice({
  name: "customer",
  initialState,
  reducers: {
    rememberCustomer(state, action: PayloadAction<{ name: string; phone: string }>) {
      state.name = action.payload.name;
      state.phone = action.payload.phone;
    },
    addRecentOrder(state, action: PayloadAction<RecentOrder>) {
      state.recentOrders = [
        action.payload,
        ...state.recentOrders.filter((o) => o.publicToken !== action.payload.publicToken),
      ].slice(0, 10);
    },
    forgetCustomer() {
      return initialState;
    },
  },
});

export const { rememberCustomer, addRecentOrder, forgetCustomer } = customerSlice.actions;
export default customerSlice.reducer;
