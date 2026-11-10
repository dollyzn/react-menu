"use client";

import { useRef, useState } from "react";
import { Banknote, ChevronRight, CircleCheck, PackageCheck, SmartphoneNfc, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import type { Order } from "@react-menu/contracts";
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
import { Spinner } from "@/components/ui/spinner";
import { ResponsiveModal } from "@/components/app/responsive-modal";
import { PointChargeDialog } from "@/components/app/point/point-charge-dialog";
import { useCompleteOrderMutation, useMarkOrderPaidMutation } from "@/redux/features/order/orderApi";
import { useGetPointConfigQuery } from "@/redux/features/point/pointApi";
import { getErrorMessage } from "@/utils/get-error-message";
import { formatCurrencyBRL } from "@/utils/string";
import { cn } from "@/lib/utils";

/**
 * "Entregar". An order not paid yet is paid first, as in the POS: on the card
 * machine (delivered when its approval is closed) or received at the counter.
 * Items that skip the kitchen (drinks, ready-made products) never show up
 * there, so the counter is reminded of them before the order leaves.
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
  const [markPaid, { isLoading: paying }] = useMarkOrderPaidMutation();
  const { data: point } = useGetPointConfigQuery(storeId);
  const canCharge = Boolean(point?.available && point.terminals.length > 0);
  const [confirming, setConfirming] = useState(false);
  const [charging, setCharging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const delivered = useRef(false);
  /** The machine approved: delivered when its dialog closes ("Concluir"), not under it. */
  const paidOnMachine = useRef(false);

  const paid = order.paymentStatus === "paid";
  const extras = order.items.filter((line) => !line.requiresPreparation);
  const busy = completing || paying;

  const deliver = async () => {
    if (delivered.current) return;
    delivered.current = true;
    try {
      await complete({ storeId, orderId: order.id }).unwrap();
    } catch (err) {
      delivered.current = false;
      throw err;
    }
    setConfirming(false);
    toast.success(`Pedido #${order.number} entregue`);
  };

  const receiveAndDeliver = async () => {
    setError(null);
    try {
      await markPaid({ storeId, orderId: order.id }).unwrap();
      await deliver();
    } catch (err) {
      setError(getErrorMessage(err as { data?: { error?: string } }, "Não foi possível entregar o pedido."));
    }
  };

  const open = () => {
    setError(null);
    if (paid && extras.length === 0) void deliver();
    else setConfirming(true);
  };

  return (
    <>
      <Button className={className} loading={busy && !confirming} onClick={open}>
        <CircleCheck /> Entregar
      </Button>

      {paid ? (
        <AlertDialog open={confirming} onOpenChange={setConfirming}>
          <AlertDialogContent size="sm">
            <AlertDialogHeader>
              <AlertDialogMedia className="bg-primary/10 text-primary">
                <PackageCheck />
              </AlertDialogMedia>
              <AlertDialogTitle>Separou tudo do pedido #{order.number}?</AlertDialogTitle>
              <AlertDialogDescription>
                {extras.length === 1 ? "Este item não passa pela cozinha" : "Estes itens não passam pela cozinha"}:
                confira se {extras.length === 1 ? "ele vai" : "eles vão"} junto.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <ExtrasList extras={extras} />
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
        <ResponsiveModal
          open={confirming}
          onOpenChange={(next) => !busy && setConfirming(next)}
          title={`Receber e entregar o pedido #${order.number}`}
          description="Receba o pagamento antes de entregar."
          hideHeader
          className="sm:max-w-md"
        >
          <div className="flex flex-col">
            {/* The amount first, as on the card machine's dialog. */}
            <header className="flex flex-col items-center gap-2 px-4 pt-6 pb-5 text-center">
              <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                <PackageCheck className="size-3.5 shrink-0" />
                <span className="truncate">
                  Pedido #{order.number} · {order.customerName}
                </span>
              </span>
              <p className="text-4xl font-black tracking-tight tabular-nums">{formatCurrencyBRL(order.total)}</p>
              <p className="text-sm text-muted-foreground">a receber na entrega</p>
            </header>

            <div className="flex flex-col gap-5 px-4 pb-4">
              {extras.length > 0 && (
                <section className="flex flex-col gap-2">
                  <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    Confira antes de entregar
                  </h3>
                  <ExtrasList extras={extras} />
                </section>
              )}

              <section className="flex flex-col gap-2">
                <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Como o cliente vai pagar
                </h3>
                <div className="grid gap-2">
                  {canCharge && (
                    <PayOption
                      icon={SmartphoneNfc}
                      label="Na maquininha"
                      hint="Envia o valor; entrega quando o pagamento for aprovado"
                      disabled={busy}
                      onClick={() => {
                        setConfirming(false);
                        setCharging(true);
                      }}
                    />
                  )}
                  <PayOption
                    icon={Banknote}
                    label="Recebi no balcão"
                    hint="Dinheiro ou Pix: marca como pago e entrega"
                    loading={busy}
                    disabled={busy}
                    onClick={() => void receiveAndDeliver()}
                  />
                </div>
              </section>

              {error && (
                <p role="alert" className="flex items-start gap-2 rounded-2xl bg-destructive/10 p-3 text-sm text-destructive">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0" /> {error}
                </p>
              )}
            </div>

            <div className="flex flex-col items-center gap-2 border-t bg-muted/30 p-4">
              <Button variant="ghost" className="w-full" disabled={busy} onClick={() => setConfirming(false)}>
                Voltar
              </Button>
            </div>
          </div>
        </ResponsiveModal>
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

function ExtrasList({ extras }: { extras: Order["items"] }) {
  return (
    <ul className="flex flex-col gap-1.5 rounded-xl bg-muted/60 p-3 text-sm" aria-label="Itens sem preparo">
      {extras.map((line) => (
        <li key={line.id} className="flex items-baseline gap-2">
          <span className="font-semibold tabular-nums">{line.quantity}×</span>
          <span className="flex-1">{line.name}</span>
        </li>
      ))}
    </ul>
  );
}

/** A way to be paid, as the tiles of the card machine's dialog. */
function PayOption({
  icon: Icon,
  label,
  hint,
  loading,
  disabled,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  hint: string;
  loading?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "group flex w-full items-center gap-3 rounded-2xl border bg-card p-3 text-left transition-all outline-none",
        "hover:border-primary/40 hover:bg-primary/5 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-60"
      )}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
        {loading ? <Spinner className="size-5" /> : <Icon className="size-5" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{label}</span>
        <span className="block text-xs leading-tight text-muted-foreground">{hint}</span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}
