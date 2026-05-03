import type { User } from "@/types/session";
import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { PURGE } from "redux-persist";

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isSessionExpired: boolean;
}

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isSessionExpired: false,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setUser: (state, action: PayloadAction<User | null>) => {
      state.user = action.payload;
      if (action.payload) state.isAuthenticated = true;
      else state.isAuthenticated = false;
    },
    setIsAuthenticated: (state, action: PayloadAction<boolean>) => {
      state.isAuthenticated = action.payload;
    },
    setIsSessionExpired: (state, action: PayloadAction<boolean>) => {
      state.isSessionExpired = action.payload;
    },
  },
  extraReducers: (builder) => {
    //purge slice
    builder.addCase(PURGE, () => {
      return initialState;
    });
  },
});

export const { setUser, setIsAuthenticated, setIsSessionExpired } =
  authSlice.actions;
export default authSlice.reducer;
