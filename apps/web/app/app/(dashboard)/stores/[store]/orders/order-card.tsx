"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Ban, Banknote, Clock, CreditCard, Globe, HandCoins, Handshake, ListPlus, MoreHorizontal, Store as StoreIcon } from "lucide-react";
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
import { useCancelOrderMutation, useMarkPayLaterMutation } from "@/redux/features/order/orderApi";
import { SendUnpaidDialog } from "@/components/app/payments/send-unpaid-dialog";
import { getErrorMessage } from "@/utils/get-error-message";
import { formatCurrencyBRL } from "@/utils/string";
import { cn } from "@/lib/utils";
import { OrderLines } from "./order-lines";
import { DeliverOrderButton } from "./deliver-order-button";
import { useStoreRole } from "@/hooks/use-store-role";
import { paidWith } from "@/components/app/payments/counter-methods";
import { ReceivePayment } from "./receive-payment";
import { CancelRequestBanner } from "./cancel-request-banner";

/** The card's "Pagar depois (fiado)": already sent, only who to charge is asked. */
const PAY_LATER_ONLY = ["payLater" as const];

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
  const [markPayLater, { isLoading: markingPayLater }] = useMarkPayLaterMutation();
  const [askingPayLater, setAskingPayLater] = useState(false);
  const [payLaterError, setPayLaterError] = useState<string | null>(null);
  // Cancelling refunds a paid order: managers only (the API refuses the rest).
  // The counter may drop one still waiting for its payment with nothing
  // received (the card was refused on the machine and it never reached the kitchen).
  const discard = order.status === "pending_payment" && order.amountPaid <= 0;
  const manager = useStoreRole(storeId) === "manager";
  // A partner's order (ADR 0024) is paid on the partner's machine and dropped
  // by the partner: the store only makes it, hands it over and (managers) cancels.
  const partnerOrder = order.channel === "partner";
  const canCancel = manager || (discard && !partnerOrder);
  const cancelRequested = Boolean(order.cancelRequest);

  const waiting = Math.max(0, Math.floor((now - new Date(order.createdAt).getTime()) / 60_000));
  const late = waiting >= etaMinutes && order.status !== "ready";
  const prepLines = order.items.filter((line) => line.requiresPreparation);
  const totalUnits = prepLines.reduce((sum, line) => sum + line.quantity, 0);
  const doneUnits = prepLines.reduce((sum, line) => sum + line.preparedQuantity, 0);
  const paid = order.paymentStatus === "paid";
  // "Pagar depois" (fiado): handed over unpaid, the managers follow it.
  const payLater = !paid && Boolean(order.payLaterAt);
  // An unpaid order in the kitchen's flow can still become "pagar depois".
  const canPayLater = !paid && !payLater && order.status !== "pending_payment" && !partnerOrder;
  // Paid, then items were added: only those are left to receive.
  const partlyPaid = !paid && order.amountPaid > 0;
  // Items can join it until the kitchen makes the first one.
  const canAdd = order.status === "received" && !partnerOrder;
  const canReceive = !paid && !partnerOrder;
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
        order.status === "pending_payment" && "border-2 border-dashed border-warning bg-warning/10",
        cancelRequested && "border-2 border-destructive/60"
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
          {partnerOrder ? (
            // Who takes it: the partner's name stands out for whoever hands it over.
            <Badge className="max-w-40 gap-1 bg-partner/15 text-partner">
              <Handshake className="size-3 shrink-0" />
              <span className="truncate">{order.partner?.name ?? "Parceiro"}</span>
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1">
              {order.channel === "online" ? <Globe className="size-3" /> : <StoreIcon className="size-3" />}
              {order.channel === "online" ? "Online" : "Balcão"}
            </Badge>
          )}
          {payLater && (
            <Badge className="gap-1 bg-primary/10 text-primary">
              <HandCoins className="size-3" /> Pagar depois
            </Badge>
          )}
        </div>
      </header>

      {order.status === "pending_payment" && (
        <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-warning/15 px-2 py-1.5 text-xs font-semibold text-warning">
          <CreditCard className="size-3.5 shrink-0" />{" "}
          {partnerOrder
            ? "Aguardando a maquininha do parceiro · ainda não foi para a cozinha"
            : "Aguardando pagamento · ainda não foi para a cozinha"}
        </p>
      )}
      <CancelRequestBanner order={order} storeId={storeId} canDecide={manager} />
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
          <p
            className={cn(
              "text-xs",
              paid ? "text-success" : payLater ? "font-medium text-primary" : partlyPaid ? "font-medium text-warning" : "text-muted-foreground"
            )}
          >
            {payLater
              ? `Pagar depois${partlyPaid ? ` · falta ${formatCurrencyBRL(order.amountDue)}` : ""}`
              : partlyPaid
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
            {order.status === "ready" && !cancelRequested && (
              <DeliverOrderButton order={order} storeId={storeId} />
            )}
            {(canReceive || canCancel || canAdd) && (
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
                {canReceive && (
                  <DropdownMenuItem onClick={() => setReceiving(true)}>
                    <Banknote /> Receber pagamento
                  </DropdownMenuItem>
                )}
                {canPayLater && (
                  <DropdownMenuItem
                    onClick={() => {
                      setPayLaterError(null);
                      setAskingPayLater(true);
                    }}
                  >
                    <HandCoins /> Pagar depois (fiado)
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

      {canOperate && (
        <SendUnpaidDialog
          storeId={storeId}
          open={askingPayLater}
          onClose={() => setAskingPayLater(false)}
          badge={`Pedido #${order.number} · ${order.customerName}`}
          total={order.amountDue}
          name={order.customerName}
          phone={order.customerPhone}
          choices={PAY_LATER_ONLY}
          verb="Deixar"
          busy={markingPayLater}
          error={payLaterError}
          onConfirm={async (confirm) => {
            if (confirm.kind !== "payLater") return;
            setPayLaterError(null);
            try {
              await markPayLater({ storeId, orderId: order.id, name: confirm.name, phone: confirm.phone }).unwrap();
              setAskingPayLater(false);
              toast.success(`Pedido #${order.number} fica para pagar depois`);
            } catch (error) {
              setPayLaterError(getErrorMessage(error as { data?: { error?: string } }, "Não foi possível marcar o pedido."));
            }
          }}
        />
      )}

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
