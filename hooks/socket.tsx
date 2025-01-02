"use client";

import { useEffect } from "react";
import { initializeSocket } from "@/lib/socket";
import { useDispatch, useSelector } from "react-redux";
import { setPrevStore, setStoreStatus } from "@/redux/slices/store";
import { AppDispatch, RootState } from "@/redux/store";

const socket = initializeSocket();

export const useStoreSocket = (store: string) => {
  const dispatch = useDispatch<AppDispatch>();
  const prevStore = useSelector((state: RootState) => state.store.prevStore);

  useEffect(() => {
    if (prevStore && prevStore !== store) {
      socket.emit("leave-store", prevStore);
    }

    socket.emit("join-store", store);

    dispatch(setPrevStore(store));

    socket.on(
      "store-status",
      (data: { storeId: string; status: Store["status"] }) => {
        dispatch(setStoreStatus(data));
      }
    );

    return () => {
      socket.off("store-status");
    };
  }, [store, dispatch]);
};
