"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Ban, Banknote, CircleCheck, Clock, Globe, MoreHorizontal, Store as StoreIcon } from "lucide-react";
import { toast } from "sonner";
import type { Order } from "@react-menu/contracts";
import { AlertDialogDestructive } from "@/components/app/alert-dialog-destructive";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import {
  useCancelOrderMutation,
  useCompleteOrderMutation,
  useMarkOrderPaidMutation,
} from "@/redux/features/order/orderApi";
import { formatCurrencyBRL } from "@/utils/string";
import { cn } from "@/lib/utils";

interface OrderCardProps {
  order: Order;
  storeId: string;
  now: number;
  /** Minutes after which the waiting time turns red. */
  etaMinutes: number;
  canOperate: boolean;
  /** Opens the order detail. */
  onOpen: (orderId: string) => void;
}

export function OrderCard({ order, storeId, now, etaMinutes, canOperate, onOpen }: OrderCardProps) {
  const [complete, { isLoading: completing }] = useCompleteOrderMutation();
  const [cancel, { isLoading: cancelling }] = useCancelOrderMutation();
  const [markPaid] = useMarkOrderPaidMutation();
  const [confirmCancel, setConfirmCancel] = useState(false);

  const waiting = Math.max(0, Math.floor((now - new Date(order.createdAt).getTime()) / 60_000));
  const late = waiting >= etaMinutes && order.status !== "ready";
  const prepLines = order.items.filter((line) => line.requiresPreparation);
  const totalUnits = prepLines.reduce((sum, line) => sum + line.quantity, 0);
  const doneUnits = prepLines.reduce((sum, line) => sum + line.preparedQuantity, 0);
  const paid = order.paymentStatus === "paid";

  const handleComplete = async () => {
    await complete({ storeId, orderId: order.id }).unwrap();
    toast.success(`Pedido #${order.number} entregue`);
  };

  return (
    <motion.article
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      aria-label={`Pedido ${order.number} de ${order.customerName}`}
      className={cn(
        "rounded-2xl border bg-card p-4 shadow-xs",
        order.status === "ready" && "border-emerald-500/50 bg-emerald-500/5"
      )}
    >
      <header className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={() => onOpen(order.id)}
          aria-label={`Ver detalhes do pedido ${order.number}`}
          className="-m-1 rounded-lg p-1 text-left outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <p className="text-2xl font-black tabular-nums">#{order.number}</p>
          <p className="font-medium">{order.customerName}</p>
        </button>
        <div className="flex flex-col items-end gap-1">
          <span
            className={cn(
              "inline-flex items-center gap-1 text-sm tabular-nums",
              late ? "font-semibold text-destructive" : "text-muted-foreground"
            )}
          >
            <Clock className="size-3.5" /> {waiting} min
          </span>
          <Badge variant="outline" className="gap-1">
            {order.channel === "online" ? <Globe className="size-3" /> : <StoreIcon className="size-3" />}
            {order.channel === "online" ? "Online" : "Balcão"}
          </Badge>
        </div>
      </header>

      <ul className="mt-3 space-y-1 text-sm">
        {order.items.map((line) => (
          <li key={line.id}>
            <span className="font-semibold tabular-nums">{line.quantity}×</span> {line.name}
            {line.addons.length > 0 && (
              <span className="text-muted-foreground"> + {line.addons.map((a) => a.name).join(", ")}</span>
            )}
            {line.notes && <span className="block text-xs font-medium text-amber-700 dark:text-amber-300">“{line.notes}”</span>}
          </li>
        ))}
      </ul>
      {order.notes && <p className="mt-2 rounded-lg bg-muted px-2 py-1 text-xs">{order.notes}</p>}

      {order.status === "preparing" && totalUnits > 0 && (
        <div className="mt-3 space-y-1">
          <Progress value={(doneUnits / totalUnits) * 100} aria-label="Progresso na cozinha" />
          <p className="text-xs text-muted-foreground tabular-nums">
            {doneUnits} de {totalUnits} prontos
          </p>
        </div>
      )}

      <footer className="mt-3 flex items-center justify-between gap-2 border-t pt-3">
        <div className="text-sm">
          <p className="font-semibold tabular-nums">{formatCurrencyBRL(order.total)}</p>
          <p className={cn("text-xs", paid ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>
            {paid ? "Pago" : order.paymentMethod === "counter" ? "Pagar na retirada" : "Aguardando pagamento"}
          </p>
        </div>
        {canOperate && order.status !== "completed" && order.status !== "cancelled" && (
          <div className="flex items-center gap-1">
            {order.status === "ready" && (
              <Button onClick={handleComplete} loading={completing}>
                <CircleCheck /> Entregar
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label={`Mais ações do pedido ${order.number}`} />}>
                <MoreHorizontal />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {!paid && (
                  <DropdownMenuItem onClick={() => markPaid({ storeId, orderId: order.id })}>
                    <Banknote /> Marcar como pago
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem variant="destructive" onClick={() => setConfirmCancel(true)}>
                  <Ban /> Cancelar pedido
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </footer>

      <AlertDialogDestructive
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        loading={cancelling}
        title={`Cancelar o pedido #${order.number}?`}
        description="O pedido sai da cozinha e o estoque usado é devolvido. Esta ação não pode ser desfeita."
        confirmLabel="Cancelar pedido"
        onConfirm={async () => {
          await cancel({ storeId, orderId: order.id }).unwrap();
          setConfirmCancel(false);
          toast.success(`Pedido #${order.number} cancelado`);
        }}
      />
    </motion.article>
  );
}
