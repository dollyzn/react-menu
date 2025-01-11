import { api } from "@/providers/request-provider";
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { PURGE } from "redux-persist";

interface Error {
  message: string;
  code: string;
}

export interface ItemState {
  indexByStore: {
    loading: boolean;
    data: Item[] | null;
    error: Error | null;
  };
  indexByCategory: {
    loading: boolean;
    data: Item[] | null;
    error: Error | null;
  };
  store: {
    loading: boolean;
    error: Error | null;
  };
  updateOrder: {
    loading: boolean;
    error: Error | null;
  };
}

const initialState: ItemState = {
  indexByStore: {
    loading: false,
    data: null,
    error: null,
  },
  indexByCategory: {
    loading: false,
    data: null,
    error: null,
  },
  store: {
    loading: false,
    error: null,
  },
  updateOrder: {
    loading: false,
    error: null,
  },
};

export const indexByStore = createAsyncThunk<Item[], string>(
  "item/indexByStore",
  async (storeId, { rejectWithValue }) => {
    try {
      const res = await api.get(`stores/${storeId}/items`);
      return res.data as Item[];
    } catch (error: any) {
      return rejectWithValue({
        ...error.response.data,
        status: error.response.status,
      });
    }
  }
);

export const indexByCategory = createAsyncThunk<Item[], number>(
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

export const store = createAsyncThunk<
  Item,
  { id: string; data: Partial<Item> }
>("item/store", async ({ id, data }, { rejectWithValue }) => {
  try {
    const res = await api.post(`items/${id}`, data);
    return res.data as Item;
  } catch (error: any) {
    return rejectWithValue({
      ...error.response.data,
      status: error.response.status,
    });
  }
});

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
    //indexByStore actions
    builder.addCase(indexByStore.pending, (state) => {
      state.indexByStore.loading = true;
      state.indexByStore.error = null;
    });

    builder.addCase(indexByStore.fulfilled, (state, action) => {
      state.indexByStore.loading = false;
      state.indexByStore.data = action.payload;
      state.indexByStore.error = null;
    });

    builder.addCase(indexByStore.rejected, (state, action) => {
      state.indexByStore.loading = false;
      state.indexByStore.error = {
        message: action.error.message || "Ocorreu um erro",
        code: action.error.code || "UNEXPECTED",
      };
    });

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

    //store actions
    builder.addCase(store.pending, (state) => {
      state.store.loading = true;
      state.store.error = null;
    });

    builder.addCase(store.fulfilled, (state, action) => {
      state.store.loading = false;
      if (state.indexByStore.data?.length) {
        if (
          state.indexByStore.data.some(
            (item) =>
              item.category &&
              action.payload.category?.storeId.includes(item.category.storeId)
          )
        ) {
          state.indexByStore.data = [
            action.payload,
            ...state.indexByStore.data,
          ];
        }
      } else {
        state.indexByStore.data = [action.payload];
      }
      if (state.indexByCategory.data?.length) {
        if (
          state.indexByCategory.data.some(
            (item) =>
              item.category && action.payload.category?.id === item.category.id
          )
        ) {
          state.indexByCategory.data = [
            action.payload,
            ...state.indexByCategory.data,
          ];
        }
      } else {
        state.indexByCategory.data = [action.payload];
      }
      state.store.error = null;
    });

    builder.addCase(store.rejected, (state, action) => {
      state.store.loading = false;
      state.store.error = {
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
