import { StoreRealtime } from "./store-realtime";

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <StoreRealtime />
      {children}
    </>
  );
}
