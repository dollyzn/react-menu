declare module "redux-persist-indexeddb-storage" {
  import localForage from "localforage";

  interface Storage {
    db: LocalForage;
    getItem: typeof localForage.getItem;
    setItem: typeof localForage.setItem;
    removeItem: typeof localForage.removeItem;
  }

  export default function storage(name: string): Storage;
}
