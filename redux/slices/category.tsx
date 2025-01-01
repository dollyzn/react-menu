import { api } from "@/providers/request-provider";
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { PURGE } from "redux-persist";

interface Error {
  message: string;
  code: string;
}

export interface CategoryState {
  loading: boolean;
  data: Category[] | null;
  error: Error | null;
  updateOrder: {
    loading: boolean;
    error: Error | null;
  };
}

const initialState: CategoryState = {
  loading: false,
  data: null,
  error: null,
  updateOrder: {
    loading: false,
    error: null,
  },
};

export const index = createAsyncThunk<Category[], string>(
  "category/index",
  async (storeId, { rejectWithValue }) => {
    try {
      const res = await api.get(`stores/${storeId}/categories`);
      return res.data as Category[];
    } catch (error: any) {
      return rejectWithValue({
        ...error.response.data,
        status: error.response.status,
      });
    }
  }
);

export const updateOrder = createAsyncThunk<
  Pick<Category, "id" | "order" | "updatedAt">[],
  { id: number; order: number }
>("category/updateOrder", async (data, { rejectWithValue }) => {
  try {
    const res = await api.patch(`categories/update-order`, data);
    return res.data as Pick<Category, "id" | "order" | "updatedAt">[];
  } catch (error: any) {
    return rejectWithValue({
      ...error.response.data,
      status: error.response.status,
    });
  }
});

const categorySlice = createSlice({
  name: "category",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    //index actions
    builder.addCase(index.pending, (state) => {
      state.loading = true;
      state.error = null;
    });

    builder.addCase(index.fulfilled, (state, action) => {
      state.loading = false;
      state.data = action.payload;
      state.error = null;
    });

    builder.addCase(index.rejected, (state, action) => {
      state.loading = false;
      state.error = {
        message: action.error.message || "Ocorreu um erro",
        code: action.error.code || "UNEXPECTED",
      };
    });

    //updateOrder actions
    builder.addCase(updateOrder.pending, (state) => {
      state.updateOrder.loading = true;
      state.updateOrder.error = null;
    });

    builder.addCase(updateOrder.fulfilled, (state, action) => {
      state.updateOrder.loading = false;
      state.data =
        state.data?.sort((a, b) => {
          const orderA =
            action.payload.find((item) => item.id === a.id)?.order ?? a.order;
          const orderB =
            action.payload.find((item) => item.id === b.id)?.order ?? b.order;

          return orderA - orderB;
        }) || null;
      state.updateOrder.error = null;
    });

    builder.addCase(updateOrder.rejected, (state, action) => {
      state.updateOrder.loading = false;
      state.updateOrder.error = {
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

export default categorySlice.reducer;
