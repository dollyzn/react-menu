import { createSlice, nanoid, type PayloadAction } from "@reduxjs/toolkit";

export type CartAddon = { id: string; name: string; price: number };

export type CartLine = {
  key: string;
  itemId: string;
  name: string;
  photoUrl: string | null;
  unitPrice: number;
  addons: CartAddon[];
  notes: string;
  quantity: number;
};

/** One cart per store: switching stores starts a fresh cart. */
interface CartState {
  storeSlug: string | null;
  lines: CartLine[];
}

const initialState: CartState = { storeSlug: null, lines: [] };

/** Same item + add-ons + notes merge into one line. */
const signature = (line: Pick<CartLine, "itemId" | "addons" | "notes">) =>
  `${line.itemId}|${line.addons.map((a) => a.id).sort().join(",")}|${line.notes.trim()}`;

const cartSlice = createSlice({
  name: "cart",
  initialState,
  reducers: {
    addLine(
      state,
      action: PayloadAction<{ storeSlug: string; line: Omit<CartLine, "key"> }>
    ) {
      const { storeSlug, line } = action.payload;
      if (state.storeSlug !== storeSlug) {
        state.storeSlug = storeSlug;
        state.lines = [];
      }
      const existing = state.lines.find((l) => signature(l) === signature(line));
      if (existing) existing.quantity = Math.min(50, existing.quantity + line.quantity);
      else state.lines.push({ ...line, key: nanoid() });
    },
    setQuantity(state, action: PayloadAction<{ key: string; quantity: number }>) {
      const line = state.lines.find((l) => l.key === action.payload.key);
      if (!line) return;
      if (action.payload.quantity <= 0) {
        state.lines = state.lines.filter((l) => l.key !== action.payload.key);
      } else {
        line.quantity = Math.min(50, action.payload.quantity);
      }
    },
    removeLine(state, action: PayloadAction<string>) {
      state.lines = state.lines.filter((l) => l.key !== action.payload);
    },
    clearCart(state) {
      state.lines = [];
    },
  },
});

export const lineUnitTotal = (line: CartLine) =>
  line.unitPrice + line.addons.reduce((sum, addon) => sum + addon.price, 0);
export const lineTotal = (line: CartLine) => lineUnitTotal(line) * line.quantity;

export const { addLine, setQuantity, removeLine, clearCart } = cartSlice.actions;
export default cartSlice.reducer;
