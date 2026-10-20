"use client";

import store from "@/redux/store";
import { Provider } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import { persistStore } from "redux-persist";

export const persistor = persistStore(store);

interface ReduxProviderProps {
  children: React.ReactNode;
}

export const ReduxProvider = ({ children }: ReduxProviderProps) => {
  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        {children}
      </PersistGate>
    </Provider>
  );
};
