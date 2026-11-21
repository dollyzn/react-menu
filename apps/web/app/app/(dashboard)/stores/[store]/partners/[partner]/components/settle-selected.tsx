"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CheckCheck } from "lucide-react";
import type { PartnerSaleRow } from "@react-menu/contracts";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useSettlePartnerMutation } from "@/redux/features/partner/partnersApi";
import { formatCurrencyBRL } from "@/utils/string";
import { usePartnerSales } from "./sales-context";

/**
 * The picked sales' commission marked paid, from the bar over the table
 * (it shows on phones too, where the table turns into cards).
 */
export function SettleSelected({ sales, onDone }: { sales: PartnerSaleRow[]; onDone: () => void }) {
  const { storeId, partnerId } = usePartnerSales();
  const [open, setOpen] = useState(false);
  const [settle, { isLoading }] = useSettlePartnerMutation();
  const rows = sales.filter((sale) => sale.settlement === "to_pay");
  if (rows.length === 0) return null;
  const total = rows.reduce((sum, sale) => sum + sale.commissionAmount, 0);

  return (
    <>
      <div
        role="status"
        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-sm"
      >
        <span>
          {rows.length} {rows.length === 1 ? "venda escolhida" : "vendas escolhidas"} ·{" "}
          <span className="font-semibold tabular-nums">{formatCurrencyBRL(total)}</span> de comissão
        </span>
        <span className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={onDone}>
            Limpar
          </Button>
          <Button size="sm" onClick={() => setOpen(true)}>
            <CheckCheck /> Marcar como {rows.length === 1 ? "paga" : "pagas"}
          </Button>
        </span>
      </div>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Marcar {formatCurrencyBRL(total)} como pago?</AlertDialogTitle>
            <AlertDialogDescription>
              A comissão de {rows.length} {rows.length === 1 ? "venda" : "vendas"} vira um acerto: some de “a pagar” aqui e na
              tela do parceiro. Dá para desfazer depois.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              loading={isLoading}
              onClick={async () => {
                await settle({ storeId, partnerId, input: { orderIds: rows.map((sale) => sale.id) } }).unwrap();
                onDone();
                setOpen(false);
                toast.success(`Comissão de ${formatCurrencyBRL(total)} marcada como paga`);
              }}
            >
              Marcar como pago
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
