"use client";

import type { PointConfig } from "@react-menu/contracts";
import { useGetPointConfigQuery, type PointArea } from "@/redux/features/point/pointApi";
import { useGetPartnerContextQuery } from "@/redux/features/partner/partnerAreaApi";

/**
 * How the machines charge, for the charge dialog and the "Na maquininha"
 * bar: the store's own machines (the POS), or the one lent to the signed-in
 * partner (ADR 0024: the partner area can't read the store's setup).
 */
export function usePointConfig(storeId: string, area: PointArea = "store"): PointConfig | undefined {
  const store = useGetPointConfigQuery(storeId, { skip: area === "partner" });
  const partner = useGetPartnerContextQuery(storeId, { skip: area !== "partner" });
  if (area !== "partner") return store.data;
  const context = partner.data;
  if (!context) return undefined;
  return {
    available: context.point.available,
    terminals: context.terminal ? [{ id: context.terminal.terminalId, name: context.terminal.name }] : [],
    paymentTypes: context.point.paymentTypes,
    maxInstallments: context.point.maxInstallments,
    printTicket: false,
    // A partner's order always waits for the machine.
    kitchenAfterPayment: true,
  };
}
