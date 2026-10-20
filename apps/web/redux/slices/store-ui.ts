import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface StoreUiState {
  prevStore: string | null;
}

const initialState: StoreUiState = {
  prevStore: null,
};

const storeUiSlice = createSlice({
  name: "storeUi",
  initialState,
  reducers: {
    setPrevStore(state, action: PayloadAction<string | null>) {
      state.prevStore = action.payload;
    },
  },
});

export const { setPrevStore } = storeUiSlice.actions;
export default storeUiSlice.reducer;
