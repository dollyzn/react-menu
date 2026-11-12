"use client";

import { useMemo, useRef, useState } from "react";
import { useLastValue } from "@/hooks/use-last-value";
import { CupSoda, CircleCheck, PackageCheck } from "lucide-react";
import { toast } from "sonner";
import type { CounterPaymentMethod, Order } from "@react-menu/contracts";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import Image from "@/components/app/image";
import { PointChargeDialog } from "@/components/app/point/point-charge-dialog";
import { ReceivePaymentDialog } from "@/components/app/payments/receive-payment-dialog";
import { paidWith } from "@/components/app/payments/counter-methods";
import { useCompleteOrderMutation, useReceiveOrderPaymentMutation } from "@/redux/features/order/orderApi";
import { useGetPointConfigQuery } from "@/redux/features/point/pointApi";
import { useGetPublicMenuQuery } from "@/redux/features/public/publicApi";
import { useGetStoreByIdQuery } from "@/redux/features/store/storeApi";
import { getErrorMessage } from "@/utils/get-error-message";

/**
 * "Entregar". Most orders were paid at the POS and only go. One to be paid
 * at pickup ("receber depois", online "pagar na retirada") is received
 * first, with how it was paid: the card machine (delivered when its approval
 * is closed) or cash/Pix/credit/debit. Items that skip the kitchen (drinks,
 * ready-made products) never show up there, so they are listed to check.
 */
export function DeliverOrderButton({
  order,
  storeId,
  className,
}: {
  order: Order;
  storeId: string;
  className?: string;
}) {
  const [complete, { isLoading: completing }] = useCompleteOrderMutation();
  const [receive, { isLoading: receiving }] = useReceiveOrderPaymentMutation();
  const { data: point } = useGetPointConfigQuery(storeId);
  const canCharge = Boolean(point?.available && point.terminals.length > 0);
  /**
   * The order as it was when "Entregar" was pressed. The dialog renders from
   * it until it has closed: receiving marks the order paid, and rendering
   * from the live order would swap the dialog for another while it closes.
   */
  const [opened, setOpened] = useState<Order | null>(null);
  const shown = useLastValue(opened) ?? order;
  const confirming = opened !== null;
  const [charging, setCharging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const delivered = useRef(false);
  /** The machine approved: delivered when its dialog closes ("Concluir"), not under it. */
  const paidOnMachine = useRef(false);

  const paid = shown.paymentStatus === "paid";
  const extras = shown.items.filter((line) => !line.requiresPreparation);
  const busy = completing || receiving;

  const deliver = async () => {
    if (delivered.current) return;
    delivered.current = true;
    try {
      await complete({ storeId, orderId: order.id }).unwrap();
    } catch (err) {
      delivered.current = false;
      throw err;
    }
    setOpened(null);
    toast.success(`Pedido #${order.number} entregue`);
  };

  const receiveAndDeliver = async (method: CounterPaymentMethod) => {
    setError(null);
    try {
      await receive({ storeId, orderId: order.id, method }).unwrap();
      await deliver();
      toast.success(`Pagamento recebido ${paidWith(method)}`);
    } catch (err) {
      setError(getErrorMessage(err as { data?: { error?: string } }, "Não foi possível entregar o pedido."));
    }
  };

  const open = () => {
    setError(null);
    const nothingToAsk = order.paymentStatus === "paid" && order.items.every((line) => line.requiresPreparation);
    if (nothingToAsk) void deliver();
    else setOpened(order);
  };

  return (
    <>
      <Button className={className} loading={busy && !confirming} onClick={open}>
        <CircleCheck /> Entregar
      </Button>

      {paid ? (
        <AlertDialog open={confirming} onOpenChange={(next) => !next && setOpened(null)}>
          <AlertDialogContent size="sm">
            <AlertDialogHeader>
              <AlertDialogMedia className="bg-primary/10 text-primary">
                <PackageCheck />
              </AlertDialogMedia>
              <AlertDialogTitle>Separou tudo do pedido #{shown.number}?</AlertDialogTitle>
              <AlertDialogDescription>
                {extras.length === 1 ? "Este item não passa pela cozinha" : "Estes itens não passam pela cozinha"}:
                confira se {extras.length === 1 ? "ele vai" : "eles vão"} junto.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <ExtrasList storeId={storeId} extras={extras} />
            <AlertDialogFooter>
              <AlertDialogCancel variant="outline" disabled={busy}>
                Voltar
              </AlertDialogCancel>
              <AlertDialogAction onClick={deliver} loading={busy}>
                Sim, entregar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : (
        <ReceivePaymentDialog
          open={confirming}
          onClose={() => setOpened(null)}
          title={`Receber e entregar o pedido #${shown.number}`}
          badge={`Pedido #${shown.number} · ${shown.customerName}`}
          total={shown.total}
          verb="Receber e entregar"
          canCharge={canCharge}
          busy={busy}
          error={error}
          onConfirm={(choice) => {
            if (choice === "machine") {
              setOpened(null);
              setCharging(true);
            } else void receiveAndDeliver(choice);
          }}
        >
          {extras.length > 0 && (
            <section className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Confira antes de entregar
              </h3>
              <ExtrasList storeId={storeId} extras={extras} />
            </section>
          )}
        </ReceivePaymentDialog>
      )}

      <PointChargeDialog
        storeId={storeId}
        order={charging ? { id: order.id, number: order.number, total: order.total } : null}
        onClose={() => {
          setCharging(false);
          if (paidOnMachine.current) void deliver();
        }}
        onPaid={() => {
          paidOnMachine.current = true;
        }}
      />
    </>
  );
}

/**
 * The items that skip the kitchen, to pick at the counter: each with its
 * photo (from the menu the POS already loads) so it is recognized at a glance.
 */
function ExtrasList({ storeId, extras }: { storeId: string; extras: Order["items"] }) {
  const { data: store } = useGetStoreByIdQuery(storeId);
  const { data: menu } = useGetPublicMenuQuery({ slug: store?.slug, preview: true }, { skip: !store });
  const catalog = useMemo(() => {
    const byId = new Map<string, { photoUrl: string | null; photoBlur: string | null; category: string }>();
    for (const category of menu?.categories ?? [])
      for (const item of category.items) byId.set(item.id, { photoUrl: item.photoUrl, photoBlur: item.photoBlur, category: category.name });
    return byId;
  }, [menu]);

  return (
    <ul className="flex min-w-0 flex-col gap-2" aria-label="Itens sem preparo">
      {extras.map((line) => {
        const known = line.itemId ? catalog.get(line.itemId) : undefined;
        return (
          <li key={line.id} className="flex items-center gap-3 rounded-2xl border bg-card p-2 pr-3 text-left">
            <span className="relative size-12 shrink-0 overflow-hidden rounded-xl bg-muted">
              {known?.photoUrl ? (
                <Image src={known.photoUrl} blurDataURL={known.photoBlur} alt="" fill sizes="48px" className="object-cover" />
              ) : (
                <CupSoda className="absolute inset-0 m-auto size-5 text-muted-foreground" />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="line-clamp-2 text-sm leading-tight font-semibold">{line.name}</span>
              {known && <span className="block truncate text-xs text-muted-foreground">{known.category}</span>}
            </span>
            <span className="shrink-0 rounded-full bg-primary px-2.5 py-0.5 text-sm font-bold text-primary-foreground tabular-nums">
              {line.quantity}×
            </span>
          </li>
        );
      })}
    </ul>
  );
}
