"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Ban, Check, X } from "lucide-react";
import type { Order } from "@react-menu/contracts";
import { AlertDialogDestructive } from "@/components/app/alert-dialog-destructive";
import { Button } from "@/components/ui/button";
import { useDecideCancelRequestMutation } from "@/redux/features/partner/partnersApi";
import { cn } from "@/lib/utils";

/**
 * Someone asked to cancel the order (a partner past their window, ADR
 * 0024): the board and the kitchen hold it, "Entregar" waits, and a
 * manager answers here. Approving cancels it (paid on a machine: refunded).
 */
export function CancelRequestBanner({
  order,
  storeId,
  canDecide,
  className = "mt-3",
}: {
  order: Order;
  storeId: string;
  canDecide: boolean;
  className?: string;
}) {
  const request = order.cancelRequest;
  const [decide, { isLoading }] = useDecideCancelRequestMutation();
  const [confirming, setConfirming] = useState(false);
  if (!request) return null;

  const answer = async (approve: boolean) => {
    await decide({ storeId, orderId: order.id, requestId: request.id, approve }).unwrap();
    setConfirming(false);
    toast.success(approve ? `Pedido #${order.number} cancelado` : `Cancelamento recusado: o pedido #${order.number} segue`);
  };

  return (
    <div role="status" className={cn("flex flex-col gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm", className)}>
      <p className="flex items-start gap-1.5 font-semibold text-destructive">
        <Ban className="mt-0.5 size-4 shrink-0" /> Cancelamento solicitado
      </p>
      <p className="text-xs">
        {order.partner?.name ?? request.requestedBy?.name ?? "Alguém"}: “{request.reason}”
      </p>
      {canDecide ? (
        <div className="flex gap-2">
          <Button size="sm" variant="destructive" onClick={() => setConfirming(true)}>
            <Check /> Aprovar
          </Button>
          <Button size="sm" variant="outline" loading={isLoading && !confirming} onClick={() => void answer(false)}>
            <X /> Recusar
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Segure o pedido: um gerente vai responder.</p>
      )}
      <AlertDialogDestructive
        open={confirming}
        onOpenChange={setConfirming}
        loading={isLoading}
        title={`Cancelar o pedido #${order.number}?`}
        description="O pedido sai da cozinha e o estoque usado é devolvido. O que foi pago na maquininha volta sozinho. Esta ação não pode ser desfeita."
        confirmLabel="Aprovar e cancelar"
        onConfirm={() => answer(true)}
      />
    </div>
  );
}
