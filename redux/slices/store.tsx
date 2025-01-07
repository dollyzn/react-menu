import { api } from "@/providers/request-provider";
import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import { isEqual } from "lodash";
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
  update: {
    loading: boolean;
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
  dashboard: {
    overview: {
      loading: boolean;
      data: Overview | null;
      error: Error | null;
    };
    recentItems: {
      loading: boolean;
      data: Item[] | null;
      error: Error | null;
    };
    chart: {
      loading: boolean;
      data: OverviewChart[] | null;
      error: Error | null;
    };
  };
  categories: {
    loading: boolean;
    data: Category[] | null;
    error: Error | null;
  };
}

interface Overview {
  accesses: {
    total: number;
    message: string;
  };
  categories: {
    total: number;
    message: string;
  };
  items: {
    total: number;
    message: string;
  };
  addons: {
    total: number;
    message: string;
  };
}

interface OverviewChart {
  date: string;
  desktop: number;
  mobile: number;
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
  update: {
    loading: false,
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
  dashboard: {
    overview: {
      loading: false,
      data: null,
      error: null,
    },
    recentItems: {
      loading: false,
      data: null,
      error: null,
    },
    chart: {
      loading: false,
      data: null,
      error: null,
    },
  },
  categories: {
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

export const update = createAsyncThunk<
  Store,
  { id: string; data: Partial<Store> }
>("store/update", async ({ id, data }, { rejectWithValue }) => {
  try {
    const res = await api.put(`/stores/${id}`, data);
    return res.data as Store;
  } catch (error: any) {
    return rejectWithValue({
      ...error.response.data,
      status: error.response.status,
    });
  }
});

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

export const overview = createAsyncThunk<Overview, string>(
  "store/dashboard/overview",
  async (id, { rejectWithValue }) => {
    try {
      const res = await api.get(`/stores/${id}/dashboard/overview`);
      return res.data as Overview;
    } catch (error: any) {
      return rejectWithValue({
        ...error.response.data,
        status: error.response.status,
      });
    }
  }
);

export const recentItems = createAsyncThunk<Item[], string>(
  "store/dashboard/recent-items",
  async (id, { rejectWithValue }) => {
    try {
      const res = await api.get(`/stores/${id}/dashboard/recent-items`);
      return res.data as Item[];
    } catch (error: any) {
      return rejectWithValue({
        ...error.response.data,
        status: error.response.status,
      });
    }
  }
);

export const chart = createAsyncThunk<OverviewChart[], string>(
  "store/dashboard/chart",
  async (id, { rejectWithValue }) => {
    try {
      const res = await api.get(`/stores/${id}/dashboard/chart`);
      return res.data as OverviewChart[];
    } catch (error: any) {
      return rejectWithValue({
        ...error.response.data,
        status: error.response.status,
      });
    }
  }
);

export const categories = createAsyncThunk<Category[], string>(
  "store/categories",
  async (id, { rejectWithValue }) => {
    try {
      const res = await api.get(`/stores/${id}/categories`);
      return res.data as Category[];
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

    //update actions
    builder.addCase(update.pending, (state) => {
      state.update.loading = true;
      state.update.error = null;
    });

    builder.addCase(update.fulfilled, (state, action) => {
      state.update.loading = false;
      if (state.show.data && state.show.data.id === action.payload.id) {
        state.show.data = { ...state.show.data, ...action.payload };
      }
      state.update.error = null;
    });

    builder.addCase(update.rejected, (state, action) => {
      state.update.loading = false;
      state.update.error = {
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

    //overview actions
    builder.addCase(overview.pending, (state) => {
      state.dashboard.overview.loading = true;
      state.dashboard.overview.error = null;
    });

    builder.addCase(overview.fulfilled, (state, action) => {
      state.dashboard.overview.loading = false;
      state.dashboard.overview.data = action.payload;
      state.dashboard.overview.error = null;
    });

    builder.addCase(overview.rejected, (state, action) => {
      state.dashboard.overview.loading = false;
      state.dashboard.overview.error = {
        message: action.error.message || "Ocorreu um erro",
        code: action.error.code || "UNEXPECTED",
      };
    });

    //recentItems actions
    builder.addCase(recentItems.pending, (state) => {
      state.dashboard.recentItems.loading = true;
      state.dashboard.recentItems.error = null;
    });

    builder.addCase(recentItems.fulfilled, (state, action) => {
      state.dashboard.recentItems.loading = false;
      state.dashboard.recentItems.data = action.payload;
      state.dashboard.recentItems.error = null;
    });

    builder.addCase(recentItems.rejected, (state, action) => {
      state.dashboard.recentItems.loading = false;
      state.dashboard.recentItems.error = {
        message: action.error.message || "Ocorreu um erro",
        code: action.error.code || "UNEXPECTED",
      };
    });

    //chart actions
    builder.addCase(chart.pending, (state) => {
      state.dashboard.chart.loading = true;
      state.dashboard.chart.error = null;
    });

    builder.addCase(chart.fulfilled, (state, action) => {
      state.dashboard.chart.loading = false;
      if (!isEqual(state.dashboard.chart.data, action.payload)) {
        state.dashboard.chart.data = action.payload;
      }
      state.dashboard.chart.error = null;
    });

    builder.addCase(chart.rejected, (state, action) => {
      state.dashboard.chart.loading = false;
      state.dashboard.chart.error = {
        message: action.error.message || "Ocorreu um erro",
        code: action.error.code || "UNEXPECTED",
      };
    });

    //categories actions
    builder.addCase(categories.pending, (state) => {
      state.categories.loading = true;
      state.categories.error = null;
    });

    builder.addCase(categories.fulfilled, (state, action) => {
      state.categories.loading = false;
      state.categories.data = action.payload;
      state.categories.error = null;
    });

    builder.addCase(categories.rejected, (state, action) => {
      state.categories.loading = false;
      state.categories.error = {
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
