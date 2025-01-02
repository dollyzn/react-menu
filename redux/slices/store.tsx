import { api } from "@/providers/request-provider";
import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import { PURGE } from "redux-persist";

interface Error {
  message: string;
  code: string;
}
export interface StoreState {
  loading: boolean;
  data: Store[] | null;
  error: Error | null;
  prevStore: string | null;
  show: {
    loading: boolean;
    data: Store | null;
    error: Error | null;
  };
  updateImages: {
    loading: boolean;
    error: Error | null;
  };
  updateStatus: {
    loading: boolean;
    error: Error | null;
  };
}

const initialState: StoreState = {
  loading: false,
  data: null,
  error: null,
  prevStore: null,
  show: {
    loading: false,
    data: null,
    error: null,
  },
  updateImages: {
    loading: false,
    error: null,
  },
  updateStatus: {
    loading: false,
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

export const updateImages = createAsyncThunk<
  Store,
  { id: string; banner?: File; photo?: File }
>("store/updateImages", async ({ id, banner, photo }, { rejectWithValue }) => {
  try {
    const res = await api.patch(
      `/stores/${id}/images`,
      { banner, photo },
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );
    return res.data as Store;
  } catch (error: any) {
    return rejectWithValue({
      ...error.response.data,
      status: error.response.status,
    });
  }
});

export const updateStatus = createAsyncThunk<
  Store,
  { id: string; status: Store["status"] }
>("store/updateStatus", async ({ id, status }, { rejectWithValue }) => {
  try {
    const res = await api.patch(`/stores/${id}/status`, { status });
    return res.data as Store;
  } catch (error: any) {
    return rejectWithValue({
      ...error.response.data,
      status: error.response.status,
    });
  }
});

const storeSlice = createSlice({
  name: "store",
  initialState,
  reducers: {
    setPrevStore(state, action: PayloadAction<string | null>) {
      state.prevStore = action.payload;
    },
    setStoreStatus: (
      state,
      action: PayloadAction<{ storeId: string; status: Store["status"] }>
    ) => {
      if (state.show.data && state.show.data.id === action.payload.storeId) {
        state.show.data.status = action.payload.status;
      }
    },
  },
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

    //updateImages actions
    builder.addCase(updateImages.pending, (state) => {
      state.updateImages.loading = true;
      state.updateImages.error = null;
    });

    builder.addCase(updateImages.fulfilled, (state, action) => {
      state.updateImages.loading = false;
      if (state.show.data && state.show.data.id === action.payload.id) {
        state.show.data = { ...state.show.data, ...action.payload };
      }
      if (state.data) {
        state.data = state.data.map((store) =>
          store.id === action.payload.id
            ? { ...store, ...action.payload }
            : store
        );
      }
      state.updateImages.error = null;
    });

    builder.addCase(updateImages.rejected, (state, action) => {
      state.updateImages.loading = false;
      state.updateImages.error = {
        message: action.error.message || "Ocorreu um erro",
        code: action.error.code || "UNEXPECTED",
      };
    });

    //updateStatus actions
    builder.addCase(updateStatus.pending, (state) => {
      state.updateStatus.loading = true;
      state.updateStatus.error = null;
    });

    builder.addCase(updateStatus.fulfilled, (state, action) => {
      state.updateStatus.loading = false;
      if (state.show.data && state.show.data.id === action.payload.id) {
        state.show.data = { ...state.show.data, ...action.payload };
      }
      if (state.data) {
        state.data = state.data.map((store) =>
          store.id === action.payload.id
            ? { ...store, ...action.payload }
            : store
        );
      }
      state.updateStatus.error = null;
    });

    builder.addCase(updateStatus.rejected, (state, action) => {
      state.updateStatus.loading = false;
      state.updateStatus.error = {
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

export const { setPrevStore, setStoreStatus } = storeSlice.actions;
export default storeSlice.reducer;
