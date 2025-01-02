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
import storeSlice, { StoreState } from "@/redux/slices/store";
import category, { CategoryState } from "@/redux/slices/category";
import item, { ItemState } from "@/redux/slices/item";

let devToolsEnabled = false;

if (typeof window !== "undefined") {
  const url = window.location.href;

  if (url.includes("localhost") || url.includes("127.0.0.1")) {
    devToolsEnabled = true;
  } else {
    devToolsEnabled = false;
  }
}

type PersistentData = {
  auth?: Partial<AuthState>;
  store?: Partial<StoreState>;
  category?: Partial<CategoryState>;
  item?: Partial<ItemState>;
};

const persistentData: PersistentData = {
  auth: {
    loading: false,
    error: null,
  },
};

const deepMerge = (target: any, source: any): any => {
  if (typeof target !== "object" || target === null) {
    return source;
  }

  const merged = { ...target };
  for (const key in source) {
    if (
      typeof source[key] === "object" &&
      source[key] !== null &&
      !Array.isArray(source[key])
    ) {
      merged[key] = deepMerge(target[key], source[key]);
    } else {
      merged[key] = source[key];
    }
  }

  return merged;
};

const transform = createTransform(
  (inboundState: any, key: keyof PersistentData) => {
    return deepMerge(inboundState, persistentData[key]);
  },

  (outboundState: any) => {
    return { ...outboundState };
  }
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
  store: storeSlice,
  category,
  item,
});

export type RootState = ReturnType<typeof reducers>;

const reducer = persistReducer<RootState>(config, reducers);

const store = configureStore({
  reducer: reducer,
  devTools: devToolsEnabled,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      thunk: true,
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
});

export type AppDispatch = typeof store.dispatch;

export default store;
