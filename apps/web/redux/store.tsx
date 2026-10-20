"use client";

import { combineReducers, configureStore } from "@reduxjs/toolkit";
import storage from "redux-persist-indexeddb-storage";
import {
  FLUSH,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
  REHYDRATE,
  persistReducer,
  createMigrate,
} from "redux-persist";
import auth from "@/redux/slices/auth";
import cart from "@/redux/slices/cart";
import customer from "@/redux/slices/customer";
import { baseApi } from "@/redux/api/baseApi";
import "@/redux/features";

let devToolsEnabled = false;

if (typeof window !== "undefined") {
  const url = window.location.href;
  devToolsEnabled = url.includes("localhost") || url.includes("127.0.0.1");
}

const migrations = {};

const getStorage = () => {
  if (typeof window === "undefined") {
    return {
      getItem() {
        return Promise.resolve(null);
      },
      setItem() {
        return Promise.resolve();
      },
      removeItem() {
        return Promise.resolve();
      },
    };
  }

  return storage("ReactMenuApp");
};

const config = {
  version: 0,
  key: "root",
  storage: getStorage(),
  whitelist: ["auth", "cart", "customer"],
  migrate: createMigrate(migrations, { debug: devToolsEnabled }),
};

const reducers = combineReducers({
  auth,
  cart,
  customer,
  [baseApi.reducerPath]: baseApi.reducer,
});

export type RootState = ReturnType<typeof reducers>;

const reducer = persistReducer<RootState>(config, reducers);

const store = configureStore({
  reducer,
  devTools: devToolsEnabled,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      thunk: true,
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }).concat(baseApi.middleware),
});

export type AppDispatch = typeof store.dispatch;

export default store;
