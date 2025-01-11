import { api } from "@/providers/request-provider";
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { PURGE } from "redux-persist";

interface Error {
  message: string;
  code: string;
}

export interface AddonState {
  indexByStore: {
    loading: boolean;
    data: Addon[] | null;
    error: Error | null;
  };
  indexByItem: {
    loading: boolean;
    data: Addon[] | null;
    error: Error | null;
  };
  store: {
    loading: boolean;
    error: Error | null;
  };
}

const initialState: AddonState = {
  indexByStore: {
    loading: false,
    data: null,
    error: null,
  },
  indexByItem: {
    loading: false,
    data: null,
    error: null,
  },
  store: {
    loading: false,
    error: null,
  },
};

export const indexByStore = createAsyncThunk<Addon[], string>(
  "addon/indexByStore",
  async (storeId, { rejectWithValue }) => {
    try {
      const res = await api.get(`stores/${storeId}/addons`);
      return res.data as Addon[];
    } catch (error: any) {
      return rejectWithValue({
        ...error.response.data,
        status: error.response.status,
      });
    }
  }
);

export const indexByItem = createAsyncThunk<Addon[], string>(
  "addon/indexByItem",
  async (itemId, { rejectWithValue }) => {
    try {
      const res = await api.get(`items/${itemId}/addons`);
      return res.data as Addon[];
    } catch (error: any) {
      return rejectWithValue({
        ...error.response.data,
        status: error.response.status,
      });
    }
  }
);

export const store = createAsyncThunk<
  Addon,
  { id: string; data: Partial<Addon> }
>("addon/store", async ({ id, data }, { rejectWithValue }) => {
  try {
    const res = await api.post(`addons/${id}`, data);
    return res.data as Addon;
  } catch (error: any) {
    return rejectWithValue({
      ...error.response.data,
      status: error.response.status,
    });
  }
});

const addonSlice = createSlice({
  name: "addon",
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

    //indexByItem actions
    builder.addCase(indexByItem.pending, (state) => {
      state.indexByItem.loading = true;
      state.indexByItem.error = null;
    });

    builder.addCase(indexByItem.fulfilled, (state, action) => {
      state.indexByItem.loading = false;
      state.indexByItem.data = action.payload;
      state.indexByItem.error = null;
    });

    builder.addCase(indexByItem.rejected, (state, action) => {
      state.indexByItem.loading = false;
      state.indexByItem.error = {
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
            (addon) => addon.storeId === action.payload.storeId
          )
        ) {
          state.indexByStore.data = [
            ...state.indexByStore.data,
            action.payload,
          ];
        }
      } else {
        state.indexByStore.data = [action.payload];
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

    //purge slice
    builder.addCase(PURGE, () => {
      return initialState;
    });
  },
});

export default addonSlice.reducer;
