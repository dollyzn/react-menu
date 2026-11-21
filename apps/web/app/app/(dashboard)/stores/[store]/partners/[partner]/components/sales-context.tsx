"use client";

import { createContext, useContext } from "react";

/** The partner whose sales the table shows: its header action settles them (columns stay module-level). */
export const PartnerSalesContext = createContext<{ storeId: string; partnerId: string } | null>(null);

export function usePartnerSales() {
  const value = useContext(PartnerSalesContext);
  if (!value) throw new Error("usePartnerSales must be used inside PartnerSalesContext");
  return value;
}
