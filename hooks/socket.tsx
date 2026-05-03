"use client";

import { useEffect } from "react";
import { initializeSocket } from "@/lib/socket";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { setPrevStore } from "@/redux/slices/store-ui";
import { baseApi } from "@/redux/api/baseApi";

const socket = initializeSocket();

export const useStoreSocket = (store: string) => {
  const dispatch = useAppDispatch();
  const prevStore = useAppSelector((state) => state.storeUi.prevStore);

  useEffect(() => {
    if (prevStore && prevStore !== store) {
      socket.emit("leave-store", prevStore);
    }

    socket.emit("join-store", store);

    dispatch(setPrevStore(store));

    socket.on(
      "store-status",
      (data: { storeId: string; status: Store["status"] }) => {
        dispatch(
          baseApi.util.invalidateTags([{ type: "Store", id: data.storeId }])
        );
      }
    );

    return () => {
      socket.off("store-status");
    };
  }, [store, dispatch]);
};
