import { api } from "@/providers/request-provider";
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { PURGE } from "redux-persist";

interface Error {
  message: string;
  code: string;
}

export interface ItemState {
  indexByCategory: {
    loading: boolean;
    data: Item[] | null;
    error: Error | null;
  };
  updateOrder: {
    loading: boolean;
    error: Error | null;
  };
}

const initialState: ItemState = {
  indexByCategory: {
    loading: false,
    data: null,
    error: null,
  },
  updateOrder: {
    loading: false,
    error: null,
  },
};

export const indexByCategory = createAsyncThunk<Item[], string>(
  "item/indexByCategory",
  async (categoryId, { rejectWithValue }) => {
    try {
      const res = await api.get(`categories/${categoryId}/items`);
      return res.data as Item[];
    } catch (error: any) {
      return rejectWithValue({
        ...error.response.data,
        status: error.response.status,
      });
    }
  }
);

export const updateOrder = createAsyncThunk<
  Pick<Item, "id" | "order" | "updatedAt">[],
  { id: number; order: number }
>("item/updateOrder", async (data, { rejectWithValue }) => {
  try {
    const res = await api.patch(`items/update-order`, data);
    return res.data as Pick<Item, "id" | "order" | "updatedAt">[];
  } catch (error: any) {
    return rejectWithValue({
      ...error.response.data,
      status: error.response.status,
    });
  }
});

const itemSlice = createSlice({
  name: "item",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    //indexByCategory actions
    builder.addCase(indexByCategory.pending, (state) => {
      state.indexByCategory.loading = true;
      state.indexByCategory.error = null;
    });

    builder.addCase(indexByCategory.fulfilled, (state, action) => {
      state.indexByCategory.loading = false;
      state.indexByCategory.data = action.payload;
      state.indexByCategory.error = null;
    });

    builder.addCase(indexByCategory.rejected, (state, action) => {
      state.indexByCategory.loading = false;
      state.indexByCategory.error = {
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
      state.indexByCategory.data =
        state.indexByCategory.data?.sort((a, b) => {
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

export default itemSlice.reducer;
