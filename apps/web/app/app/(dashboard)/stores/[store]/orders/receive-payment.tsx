"use client";

import { useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import type { CounterPaymentMethod, Order } from "@react-menu/contracts";
import { PointChargeDialog } from "@/components/app/point/point-charge-dialog";
import { ReceivePaymentDialog } from "@/components/app/payments/receive-payment-dialog";
import { paidWith } from "@/components/app/payments/counter-methods";
import { useReceiveOrderPaymentMutation } from "@/redux/features/order/orderApi";
import { useGetPointConfigQuery } from "@/redux/features/point/pointApi";
import { getErrorMessage } from "@/utils/get-error-message";

/**
 * "Receber pagamento" of an order not paid yet (paid later, or online
 * "pagar na retirada"): on the card machine, or recorded as
 * cash/Pix/credit/debit. From the card's menu, the order detail, and
 * "Entregar" (which hands the order over after it: `afterPaid`).
 */
export function ReceivePayment({
  order,
  storeId,
  open,
  onClose,
  verb,
  busy = false,
  afterPaid,
  children,
}: {
  order: Pick<Order, "id" | "number" | "total" | "customerName">;
  storeId: string;
  open: boolean;
  onClose: () => void;
  /** The confirm button's verb ("Receber e entregar"). */
  verb?: string;
  /** Work of the caller still running (the hand-over). */
  busy?: boolean;
  /**
   * After the payment: received at the counter, or the card machine's
   * approval closed ("Concluir"), never under it. Without it, a toast says
   * it was received.
   */
  afterPaid?: () => Promise<void>;
  /** Above the methods (the items to check before delivering). */
  children?: ReactNode;
}) {
  const [receive, { isLoading }] = useReceiveOrderPaymentMutation();
  const { data: point } = useGetPointConfigQuery(storeId);
  const canCharge = Boolean(point?.available && point.terminals.length > 0);
  const [charging, setCharging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const paidOnMachine = useRef(false);

  const confirm = async (method: CounterPaymentMethod) => {
    setError(null);
    try {
      await receive({ storeId, orderId: order.id, method }).unwrap();
      if (afterPaid) await afterPaid();
      else toast.success(`Pedido #${order.number}: pagamento recebido ${paidWith(method)}`);
      onClose();
    } catch (err) {
      setError(getErrorMessage(err as { data?: { error?: string } }, "Não foi possível registrar o pagamento."));
    }
  };

  return (
    <>
      <ReceivePaymentDialog
        open={open}
        onClose={() => {
          setError(null);
          onClose();
        }}
        title={`${verb ?? "Receber"} o pedido #${order.number}`}
        badge={`Pedido #${order.number} · ${order.customerName}`}
        total={order.total}
        verb={verb}
        canCharge={canCharge}
        busy={isLoading || busy}
        error={error}
        onConfirm={(choice) => {
          if (choice !== "machine") return void confirm(choice);
          paidOnMachine.current = false;
          onClose();
          setCharging(true);
        }}
      >
        {children}
      </ReceivePaymentDialog>
      <PointChargeDialog
        storeId={storeId}
        order={charging ? { id: order.id, number: order.number, total: order.total } : null}
        onClose={() => {
          setCharging(false);
          if (paidOnMachine.current && afterPaid) void afterPaid().catch(() => undefined);
        }}
        onPaid={() => {
          paidOnMachine.current = true;
        }}
      />
    </>
  );
}
