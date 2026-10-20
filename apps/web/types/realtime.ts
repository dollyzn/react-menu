/** Mirrors `StoreEvent` in apps/api/app/helpers/realtime.ts. */
export type StoreEvent = {
  type: "store.status_changed";
  storeId: string;
  status: Store["status"];
};
