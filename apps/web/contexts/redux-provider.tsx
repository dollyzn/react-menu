"use client";

import store from "@/redux/store";
import { Provider } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import { persistStore } from "redux-persist";

export const persistor = persistStore(store);

interface ReduxProviderProps {
  children: React.ReactNode;
}

/**
 * Children always render (also on the server). Code that depends on the
 * persisted session must wait for `useRehydrated()`.
 */
export const ReduxProvider = ({ children }: ReduxProviderProps) => {
  return (
    <Provider store={store}>
      <PersistGate persistor={persistor}>{() => children}</PersistGate>
    </Provider>
  );
};
