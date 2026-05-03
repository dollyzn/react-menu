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
  createTransform,
  createMigrate,
} from "redux-persist";
import auth, { AuthState } from "@/redux/slices/auth";
import storeUi from "@/redux/slices/store-ui";
import { baseApi } from "@/redux/api/baseApi";
import "@/redux/features";

let devToolsEnabled = false;

if (typeof window !== "undefined") {
  const url = window.location.href;
  devToolsEnabled = url.includes("localhost") || url.includes("127.0.0.1");
}

type PersistentData = {
  auth?: Partial<AuthState>;
};

const persistentData: PersistentData = {};

const deepMerge = (target: unknown, source: unknown): unknown => {
  if (typeof target !== "object" || target === null) {
    return source;
  }
  if (typeof source !== "object" || source === null) {
    return source;
  }
  const merged = { ...(target as Record<string, unknown>) };
  for (const key in source as Record<string, unknown>) {
    const srcVal = (source as Record<string, unknown>)[key];
    const tgtVal = (target as Record<string, unknown>)[key];
    if (
      typeof srcVal === "object" &&
      srcVal !== null &&
      !Array.isArray(srcVal)
    ) {
      merged[key] = deepMerge(tgtVal, srcVal);
    } else {
      merged[key] = srcVal;
    }
  }
  return merged;
};

const transform = createTransform<AuthState, AuthState, RootState>(
  (inboundState, key) => {
    if (key === "auth") {
      return deepMerge(inboundState, persistentData.auth) as AuthState;
    }
    return inboundState;
  },
  (outboundState) => outboundState,
  { whitelist: ["auth"] }
);

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
  transforms: [transform],
  whitelist: ["auth"],
  migrate: createMigrate(migrations, { debug: devToolsEnabled }),
};

const reducers = combineReducers({
  auth,
  storeUi,
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
