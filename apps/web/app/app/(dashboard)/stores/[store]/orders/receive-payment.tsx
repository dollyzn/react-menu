"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { Order } from "@react-menu/contracts";
import { PointChargeDialog } from "@/components/app/point/point-charge-dialog";
import { ReceivePaymentDialog } from "@/components/app/payments/receive-payment-dialog";
import { paidWith } from "@/components/app/payments/counter-methods";
import { useReceiveOrderPaymentMutation } from "@/redux/features/order/orderApi";
import { useGetPointConfigQuery } from "@/redux/features/point/pointApi";
import { getErrorMessage } from "@/utils/get-error-message";

/**
 * "Receber pagamento" of an order not paid yet (paid later, or online
 * "pagar na retirada"), from the board's card menu or the order detail:
 * on the card machine, or recorded as cash/Pix/credit/debit.
 */
export function ReceivePayment({
  order,
  storeId,
  open,
  onClose,
}: {
  order: Pick<Order, "id" | "number" | "total" | "customerName">;
  storeId: string;
  open: boolean;
  onClose: () => void;
}) {
  const [receive, { isLoading }] = useReceiveOrderPaymentMutation();
  const { data: point } = useGetPointConfigQuery(storeId);
  const canCharge = Boolean(point?.available && point.terminals.length > 0);
  const [charging, setCharging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <ReceivePaymentDialog
        open={open}
        onClose={() => {
          setError(null);
          onClose();
        }}
        title={`Receber o pedido #${order.number}`}
        badge={`Pedido #${order.number} · ${order.customerName}`}
        total={order.total}
        canCharge={canCharge}
        busy={isLoading}
        error={error}
        onConfirm={async (choice) => {
          if (choice === "machine") {
            onClose();
            setCharging(true);
            return;
          }
          setError(null);
          try {
            await receive({ storeId, orderId: order.id, method: choice }).unwrap();
            onClose();
            toast.success(`Pedido #${order.number}: pagamento recebido ${paidWith(choice)}`);
          } catch (err) {
            setError(getErrorMessage(err as { data?: { error?: string } }, "Não foi possível registrar o pagamento."));
          }
        }}
      />
      <PointChargeDialog
        storeId={storeId}
        order={charging ? { id: order.id, number: order.number, total: order.total } : null}
        onClose={() => setCharging(false)}
      />
    </>
  );
}
