"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Ban, Banknote, Clock, CreditCard, Globe, ListPlus, MoreHorizontal, Store as StoreIcon } from "lucide-react";
import { useRouter } from "next/navigation";
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
import { useCancelOrderMutation } from "@/redux/features/order/orderApi";
import { formatCurrencyBRL } from "@/utils/string";
import { cn } from "@/lib/utils";
import { OrderLines } from "./order-lines";
import { DeliverOrderButton } from "./deliver-order-button";
import { useStoreRole } from "@/hooks/use-store-role";
import { paidWith } from "@/components/app/payments/counter-methods";
import { ReceivePayment } from "./receive-payment";

interface OrderCardProps {
  order: Order;
  storeId: string;
  now: number;
  /** Minutes after which the waiting time turns red. */
  etaMinutes: number;
  canOperate: boolean;
  /** Opens the order detail (managers; without it the card doesn't open). */
  onOpen?: (orderId: string) => void;
}

export function OrderCard({ order, storeId, now, etaMinutes, canOperate, onOpen }: OrderCardProps) {
  const [cancel, { isLoading: cancelling }] = useCancelOrderMutation();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [receiving, setReceiving] = useState(false);
  // Cancelling refunds a paid order: managers only (the API refuses the rest).
  // The counter may drop one still waiting for its payment with nothing
  // received (the card was refused on the machine and it never reached the kitchen).
  const discard = order.status === "pending_payment" && order.amountPaid <= 0;
  const canCancel = useStoreRole(storeId) === "manager" || discard;

  const waiting = Math.max(0, Math.floor((now - new Date(order.createdAt).getTime()) / 60_000));
  const late = waiting >= etaMinutes && order.status !== "ready";
  const prepLines = order.items.filter((line) => line.requiresPreparation);
  const totalUnits = prepLines.reduce((sum, line) => sum + line.quantity, 0);
  const doneUnits = prepLines.reduce((sum, line) => sum + line.preparedQuantity, 0);
  const paid = order.paymentStatus === "paid";
  // Paid, then items were added: only those are left to receive.
  const partlyPaid = !paid && order.amountPaid > 0;
  // Items can join it until the kitchen makes the first one.
  const canAdd = order.status === "received";
  const router = useRouter();

  return (
    <motion.article
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      aria-label={`Pedido ${order.number} de ${order.customerName}`}
      className={cn(
        "rounded-2xl border bg-card p-4 shadow-xs",
        order.status === "ready" && "border-success/50 bg-success/5",
        // Held for the card machine: in the queue's place, not in the kitchen yet.
        order.status === "pending_payment" && "border-2 border-dashed border-warning bg-warning/10"
      )}
    >
      <header className="flex items-start justify-between gap-2">
        {onOpen ? (
          <button
            type="button"
            onClick={() => onOpen(order.id)}
            aria-label={`Ver detalhes do pedido ${order.number}`}
            className="-m-1 min-w-0 rounded-lg p-1 text-left outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <OrderTitle order={order} />
          </button>
        ) : (
          <div className="min-w-0">
            <OrderTitle order={order} />
          </div>
        )}
        <div className="flex shrink-0 flex-col items-end gap-1">
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

      {order.status === "pending_payment" && (
        <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-warning/15 px-2 py-1.5 text-xs font-semibold text-warning">
          <CreditCard className="size-3.5 shrink-0" /> Aguardando pagamento · ainda não foi para a cozinha
        </p>
      )}
      <OrderLines items={order.items} className="mt-3" />
      {order.notes && <p className="mt-2 rounded-lg bg-muted px-2 py-1 text-xs">{order.notes}</p>}

      {order.status === "preparing" && totalUnits > 0 && (
        <div className="mt-3 flex flex-col gap-1">
          <Progress value={(doneUnits / totalUnits) * 100} aria-label="Progresso na cozinha" />
          <p className="text-xs text-muted-foreground tabular-nums">
            {doneUnits} de {totalUnits} prontos
          </p>
        </div>
      )}

      <footer className="mt-3 flex items-center justify-between gap-2 border-t pt-3">
        <div className="text-sm">
          <p className="font-semibold tabular-nums">{formatCurrencyBRL(order.total)}</p>
          <p className={cn("text-xs", paid ? "text-success" : partlyPaid ? "font-medium text-warning" : "text-muted-foreground")}>
            {partlyPaid
              ? `Falta receber ${formatCurrencyBRL(order.amountDue)}`
              : paid
              ? order.counterMethod
                ? `Pago ${paidWith(order.counterMethod)}`
                : order.paymentMethod === "point"
                  ? "Pago na maquininha"
                  : "Pago"
              : order.paymentMethod === "counter" && order.status !== "pending_payment"
                ? "Falta receber"
                : "Aguardando pagamento"}
          </p>
        </div>
        {canOperate && order.status !== "completed" && order.status !== "cancelled" && (
          <div className="flex items-center gap-1">
            {order.status === "ready" && (
              <DeliverOrderButton order={order} storeId={storeId} />
            )}
            {(!paid || canCancel || canAdd) && (
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label={`Mais ações do pedido ${order.number}`} />}>
                <MoreHorizontal />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {canAdd && (
                  <DropdownMenuItem onClick={() => router.push(`/app/stores/${storeId}/pos?pedido=${order.id}`)}>
                    <ListPlus /> Adicionar itens
                  </DropdownMenuItem>
                )}
                {!paid && (
                  <DropdownMenuItem onClick={() => setReceiving(true)}>
                    <Banknote /> Receber pagamento
                  </DropdownMenuItem>
                )}
                {canCancel && (
                  <DropdownMenuItem variant="destructive" onClick={() => setConfirmCancel(true)}>
                    <Ban /> {discard ? "Descartar pedido" : "Cancelar pedido"}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            )}
          </div>
        )}
      </footer>

      {/* Mounted while the order turns paid, so it closes smoothly (closed, it fetches nothing). */}
      {canOperate && (
        <ReceivePayment order={order} storeId={storeId} open={receiving} onClose={() => setReceiving(false)} />
      )}

      <AlertDialogDestructive
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        loading={cancelling}
        title={discard ? `Descartar o pedido #${order.number}?` : `Cancelar o pedido #${order.number}?`}
        description={
          discard
            ? "O pedido ainda não foi para a cozinha e nada foi pago. Ele sai do quadro. Esta ação não pode ser desfeita."
            : order.amountPaid > 0
            ? "O pedido sai da cozinha e o estoque usado é devolvido. Pagamentos online e na maquininha voltam sozinhos; o que foi recebido no balcão, devolva em mãos. Esta ação não pode ser desfeita."
            : "O pedido sai da cozinha e o estoque usado é devolvido. Esta ação não pode ser desfeita."
        }
        confirmLabel={discard ? "Descartar pedido" : "Cancelar pedido"}
        onConfirm={async () => {
          await cancel({ storeId, orderId: order.id }).unwrap();
          setConfirmCancel(false);
          toast.success(`Pedido #${order.number} ${discard ? "descartado" : "cancelado"}`);
        }}
      />
    </motion.article>
  );
}

/**
 * The number and, as big, the customer's name: the counter calls people by
 * name ("Maria!"), and the number is what they check on their phone.
 */
function OrderTitle({ order }: { order: Order }) {
  return (
    <>
      <p className="text-xl leading-none font-black tabular-nums">#{order.number}</p>
      <p className="mt-1.5 line-clamp-2 text-xl leading-tight font-bold wrap-break-word">{order.customerName}</p>
    </>
  );
}
