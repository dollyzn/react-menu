import { api } from "@/providers/request-provider";
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { PURGE } from "redux-persist";

interface Error {
  message: string;
  code: string;
}
export interface StoreState {
  loading: boolean;
  data: Store[] | null;
  error: Error | null;
  show: {
    loading: boolean;
    data: Store | null;
    error: Error | null;
  };
}

const initialState: StoreState = {
  loading: false,
  data: null,
  error: null,
  show: {
    loading: false,
    data: null,
    error: null,
  },
};

export const show = createAsyncThunk<Store, string>(
  "store/show",
  async (id, { rejectWithValue }) => {
    try {
      const res = await api.get(`/stores/${id}`);
      return res.data as Store;
    } catch (error: any) {
      return rejectWithValue({
        ...error.response.data,
        status: error.response.status,
      });
    }
  }
);

const storeSlice = createSlice({
  name: "store",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    //show actions
    builder.addCase(show.pending, (state) => {
      state.show.loading = true;
      state.show.error = null;
    });

    builder.addCase(show.fulfilled, (state, action) => {
      state.show.loading = false;
      state.show.data = action.payload;
      state.show.error = null;
    });

    builder.addCase(show.rejected, (state, action) => {
      state.show.loading = false;
      state.show.error = {
        message: action.error.message || "Ocorreu um erro",
        code: action.error.code || "UNEXPECTED",
      };
    });

    //purge slice
    builder.addCase(PURGE, () => {
      return initialState;
    });
  },
});

export default storeSlice.reducer;
