"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle, Ban, Banknote, CircleCheck, ExternalLink, MessageCircle, Phone, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { AlertDialogDestructive } from "@/components/app/alert-dialog-destructive";
import { Button, buttonVariants } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useCancelOrderMutation,
  useCompleteOrderMutation,
  useGetOrderQuery,
  useMarkOrderPaidMutation,
  useRefundOrderMutation,
} from "@/redux/features/order/orderApi";
import { useStoreRole } from "@/hooks/use-store-role";
import { formatCurrencyBRL, formatPhoneBR } from "@/utils/string";
import { cn } from "@/lib/utils";
import { ATTEMPT, CHANNEL, PAYMENT, STATUS } from "./order-labels";

const ACTIVE = new Set(["pending_payment", "received", "preparing", "ready"]);

/** Everything about one order, with its timeline and the counter actions. */
export function OrderDetailSheet({
  storeId,
  orderId,
  canOperate,
  onClose,
}: {
  storeId: string;
  orderId: string | null;
  canOperate: boolean;
  onClose: () => void;
}) {
  const { data: order, isFetching } = useGetOrderQuery(
    { storeId, orderId: orderId ?? "" },
    { skip: !orderId }
  );
  const [complete, { isLoading: completing }] = useCompleteOrderMutation();
  const [cancel, { isLoading: cancelling }] = useCancelOrderMutation();
  const [markPaid, { isLoading: paying }] = useMarkOrderPaidMutation();
  const [refund, { isLoading: refunding }] = useRefundOrderMutation();
  const isManager = useStoreRole(storeId) === "manager";
  const [confirmCancel, setConfirmCancel] = useState(false);

  const show = order && order.id === orderId ? order : null;
  const phone = show?.customerPhone?.replace(/^55/, "");

  return (
    <Sheet open={Boolean(orderId)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full gap-0 sm:max-w-md">
        {!show ? (
          <div className="flex flex-col gap-3 p-4" aria-busy={isFetching}>
            <SheetHeader className="p-0">
              <SheetTitle>Carregando pedido…</SheetTitle>
              <SheetDescription className="sr-only">Detalhes do pedido</SheetDescription>
            </SheetHeader>
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-40 rounded-xl" />
          </div>
        ) : (
          <>
            <SheetHeader className="border-b">
              <div className="flex items-center gap-3">
                <SheetTitle className="text-3xl font-black tabular-nums">#{show.number}</SheetTitle>
                <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", STATUS[show.status].tone)}>
                  {STATUS[show.status].label}
                </span>
              </div>
              <SheetDescription>
                {format(parseISO(show.createdAt), "EEEE, dd/MM 'às' HH:mm", { locale: ptBR })}
              </SheetDescription>
            </SheetHeader>

            <div className="flex-1 flex flex-col gap-5 overflow-y-auto p-4">
              <section aria-label="Cliente" className="rounded-xl border p-3">
                <p className="font-semibold">{show.customerName}</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                  {(() => {
                    const channel = CHANNEL[show.channel];
                    return (
                      <>
                        <channel.icon className="size-3.5" /> {channel.label} · {PAYMENT[show.paymentMethod]} ·{" "}
                        <span
                          className={cn(
                            show.paymentStatus === "paid" && "text-success",
                            show.paymentStatus === "refunded" && "text-muted-foreground"
                          )}
                        >
                          {show.paymentStatus === "paid"
                            ? "pago"
                            : show.paymentStatus === "refunded"
                              ? "reembolsado"
                              : "não pago"}
                        </span>
                      </>
                    );
                  })()}
                </p>
                {phone && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <a href={`tel:+55${phone}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                      <Phone /> {formatPhoneBR(phone)}
                    </a>
                    <a
                      href={`https://wa.me/55${phone}`}
                      target="_blank"
                      rel="noreferrer"
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                      <MessageCircle /> WhatsApp
                    </a>
                  </div>
                )}
              </section>

              <section aria-label="Itens">
                <ul className="divide-y rounded-xl border">
                  {show.items.map((line) => (
                    <li key={line.id} className="flex justify-between gap-3 p-3 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium">
                          <span className="tabular-nums">{line.quantity}×</span> {line.name}
                        </p>
                        {line.addons.length > 0 && (
                          <p className="text-xs text-muted-foreground">+ {line.addons.map((a) => a.name).join(", ")}</p>
                        )}
                        {line.notes && (
                          <p className="text-xs font-medium text-warning">“{line.notes}”</p>
                        )}
                        {line.requiresPreparation && show.status === "preparing" && (
                          <p className="text-xs text-muted-foreground tabular-nums">
                            {line.preparedQuantity} de {line.quantity} prontos
                          </p>
                        )}
                      </div>
                      <span className="shrink-0 tabular-nums">{formatCurrencyBRL(line.total)}</span>
                    </li>
                  ))}
                  <li className="flex justify-between p-3 font-semibold">
                    <span>Total</span>
                    <span className="tabular-nums">{formatCurrencyBRL(show.total)}</span>
                  </li>
                </ul>
                {show.notes && <p className="mt-2 rounded-lg bg-muted px-3 py-2 text-sm">{show.notes}</p>}
              </section>

              {(show.refundPending || (show.payments && show.payments.length > 0)) && (
                <section aria-labelledby="order-payments" className="flex flex-col gap-2">
                  <h3 id="order-payments" className="text-sm font-semibold">
                    Pagamento online
                  </h3>
                  {show.refundPending && (
                    <div className="flex flex-col gap-2 rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm">
                      <p className="flex items-start gap-2 font-medium text-warning">
                        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                        Reembolso pendente: o pedido foi cancelado, mas o valor ainda não voltou para o cliente.
                      </p>
                      {isManager ? (
                        <Button
                          size="sm"
                          variant="outline"
                          loading={refunding}
                          onClick={async () => {
                            try {
                              await refund({ storeId, orderId: show.id }).unwrap();
                              toast.success(`Pedido #${show.number} reembolsado`);
                            } catch {
                              // baseApi shows the gateway's answer.
                            }
                          }}
                        >
                          <Undo2 /> Reembolsar agora
                        </Button>
                      ) : (
                        <p className="text-xs text-muted-foreground">Peça a um gerente para reembolsar.</p>
                      )}
                    </div>
                  )}
                  {show.payments && show.payments.length > 0 && (
                    <ul className="divide-y rounded-xl border text-sm">
                      {show.payments.map((payment, index) => (
                        <li key={index} className="flex items-center justify-between gap-3 p-3">
                          <span>
                            {PAYMENT[payment.method]}{" "}
                            <span className="text-xs text-muted-foreground tabular-nums">
                              · {format(parseISO(payment.createdAt), "HH:mm")}
                            </span>
                          </span>
                          <span
                            className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", ATTEMPT[payment.status].tone)}
                            title={payment.statusDetail ?? undefined}
                          >
                            {ATTEMPT[payment.status].label}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              )}

              {show.history && show.history.length > 0 && (
                <section aria-labelledby="order-timeline">
                  <h3 id="order-timeline" className="mb-2 text-sm font-semibold">
                    Linha do tempo
                  </h3>
                  <ol className="relative flex flex-col gap-3 border-l pl-4">
                    {show.history.map((entry, index) => (
                      <li key={index} className="relative text-sm">
                        <span className="absolute top-1.5 -left-5.25 size-2.5 rounded-full bg-primary ring-4 ring-background" />
                        <p className="font-medium">{STATUS[entry.toStatus].label}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(parseISO(entry.createdAt), "HH:mm")} ·{" "}
                          {entry.user?.name ?? (show.channel === "online" ? "Cliente / sistema" : "Sistema")}
                        </p>
                      </li>
                    ))}
                  </ol>
                </section>
              )}

              <a
                href={`/pedido/${show.publicToken}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
              >
                Ver página do cliente <ExternalLink className="size-3.5" />
              </a>
            </div>

            {canOperate && ACTIVE.has(show.status) && (
              <footer className="flex flex-wrap gap-2 border-t p-4">
                {show.status === "ready" && (
                  <Button
                    className="flex-1"
                    loading={completing}
                    onClick={async () => {
                      await complete({ storeId, orderId: show.id }).unwrap();
                      toast.success(`Pedido #${show.number} entregue`);
                    }}
                  >
                    <CircleCheck /> Entregar
                  </Button>
                )}
                {show.paymentStatus !== "paid" && (
                  <Button variant="outline" loading={paying} onClick={() => markPaid({ storeId, orderId: show.id })}>
                    <Banknote /> Marcar pago
                  </Button>
                )}
                <Button variant="ghost" className="text-destructive" onClick={() => setConfirmCancel(true)}>
                  <Ban /> Cancelar
                </Button>
              </footer>
            )}

            <AlertDialogDestructive
              open={confirmCancel}
              onOpenChange={setConfirmCancel}
              loading={cancelling}
              title={`Cancelar o pedido #${show.number}?`}
              description={
                show.paymentStatus === "paid" && show.paymentMethod !== "counter"
                  ? "O pedido sai da cozinha, o estoque usado é devolvido e o valor pago online é reembolsado ao cliente. Esta ação não pode ser desfeita."
                  : "O pedido sai da cozinha e o estoque usado é devolvido. Esta ação não pode ser desfeita."
              }
              confirmLabel="Cancelar pedido"
              onConfirm={async () => {
                await cancel({ storeId, orderId: show.id }).unwrap();
                setConfirmCancel(false);
                toast.success(`Pedido #${show.number} cancelado`);
              }}
            />
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
