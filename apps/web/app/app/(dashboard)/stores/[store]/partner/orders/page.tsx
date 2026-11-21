"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { Ban, Check, CircleCheck, Clock, CreditCard, SmartphoneNfc, Undo2, X } from "lucide-react";
import type { PartnerOrder, PartnerOrderStage, PointCharge } from "@react-menu/contracts";
import { AlertDialogDestructive } from "@/components/app/alert-dialog-destructive";
import { PartnerAreaGate } from "@/components/app/partner/partner-area-gate";
import { PointChargeDialog } from "@/components/app/point/point-charge-dialog";
import { PendingChargesBar } from "@/components/app/point/pending-charges-bar";
import { PageHeader } from "@/components/app/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useLastValue } from "@/hooks/use-last-value";
import { useNow } from "@/hooks/use-now";
import { cn } from "@/lib/utils";
import {
  useCancelPartnerOrderMutation,
  useDeliverPartnerOrderMutation,
  useGetPartnerOrdersQuery,
  useRequestPartnerCancelMutation,
} from "@/redux/features/partner/partnerAreaApi";
import { OrderLines } from "../../orders/order-lines";
import { formatCurrencyBRL } from "@/utils/string";

/** The partner's board, like the store's: three columns in the order the sale moves. */
const COLUMNS: { key: string; title: string; tab: string; stages: PartnerOrderStage[]; empty: string }[] = [
  {
    key: "kitchen",
    title: "Na cozinha da loja",
    tab: "Cozinha",
    // Waiting for the machine first (amber): they go once paid.
    stages: ["awaiting_payment", "in_kitchen"],
    empty: "Nenhuma venda na cozinha.",
  },
  { key: "ready", title: "Pronto na loja", tab: "Prontos", stages: ["ready"], empty: "Nada pronto esperando você." },
  { key: "with", title: "Com você", tab: "Com você", stages: ["with_partner"], empty: "Nada para entregar agora." },
];

/**
 * "Meus pedidos" (ADR 0024): the partner follows each sale from the
 * machine to the store's kitchen, the hand-over to them, and their own
 * hand-over to the customer. Live from the partner's channel.
 */
export default function PartnerOrdersPage() {
  const { store: storeId } = useParams<{ store: string }>();
  return (
    <PartnerAreaGate storeId={storeId}>
      <PartnerOrders storeId={storeId} />
    </PartnerAreaGate>
  );
}

function PartnerOrders({ storeId }: { storeId: string }) {
  // A 30 s poll covers a dropped event stream.
  const { data: orders = [], isLoading } = useGetPartnerOrdersQuery(
    { storeId },
    { pollingInterval: 30_000, skipPollingIfUnfocused: true }
  );
  const [charging, setCharging] = useState<{ id: string; number: number; total: number } | null>(null);
  const [resuming, setResuming] = useState<PointCharge | null>(null);
  const [mobileColumn, setMobileColumn] = useState(COLUMNS[0].key);
  const now = useNow(30_000);
  const inColumn = (stages: PartnerOrderStage[]) =>
    stages.flatMap((stage) => orders.filter((order) => order.stage === stage));
  const finished = orders.filter((order) => order.stage === "delivered" || order.stage === "cancelled");

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <PageHeader title="Meus pedidos" description="Da maquininha à cozinha da loja, até você entregar ao cliente." />
      <PendingChargesBar
        storeId={storeId}
        area="partner"
        onOpen={(charge) => {
          setResuming(charge);
          setCharging(charge.order);
        }}
      />

      <Tabs value={mobileColumn} onValueChange={(value) => setMobileColumn(String(value))} className="md:hidden">
        <TabsList className="grid w-full grid-cols-3">
          {COLUMNS.map((column) => (
            <TabsTrigger key={column.key} value={column.key}>
              {column.tab} ({inColumn(column.stages).length})
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="grid gap-4 md:grid-cols-3">
        {COLUMNS.map((column) => {
          const list = inColumn(column.stages);
          return (
            <section
              key={column.key}
              aria-label={column.title}
              className={cn("flex flex-col gap-3", mobileColumn !== column.key && "max-md:hidden")}
            >
              <h2 className="flex items-center justify-between text-sm font-semibold tracking-wider text-muted-foreground uppercase">
                {column.title}
                <span className="rounded-full bg-muted px-2 py-0.5 tabular-nums">{list.length}</span>
              </h2>
              {isLoading ? (
                <Skeleton className="h-40 rounded-2xl" />
              ) : list.length === 0 ? (
                <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">{column.empty}</p>
              ) : (
                <AnimatePresence initial={false}>
                  {list.map((order) => (
                    <PartnerOrderCard
                      key={order.id}
                      order={order}
                      storeId={storeId}
                      now={now}
                      onCharge={() => setCharging({ id: order.id, number: order.number, total: order.amountDue })}
                    />
                  ))}
                </AnimatePresence>
              )}
            </section>
          );
        })}
      </div>

      {finished.length > 0 && <FinishedToday orders={finished} />}

      <PointChargeDialog
        storeId={storeId}
        area="partner"
        order={charging}
        resume={resuming}
        onClose={() => {
          setCharging(null);
          setResuming(null);
        }}
      />
    </div>
  );
}

/** Today's sales that are over: delivered to the customer, or cancelled (no commission). */
function FinishedToday({ orders }: { orders: PartnerOrder[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Entregues e cancelados hoje</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {orders.map((order) => (
            <li key={order.id} className="flex items-center gap-3 py-2.5 text-sm">
              {order.stage === "delivered" ? (
                <CircleCheck className="size-4 shrink-0 text-success" />
              ) : (
                <Ban className="size-4 shrink-0 text-muted-foreground" />
              )}
              <span className="min-w-0 flex-1 truncate">
                <span className="font-black tabular-nums">#{order.number}</span> · {order.customerName}
              </span>
              {/* The partner's attendants don't see the commission: the sale's total instead. */}
              {order.commissionAmount === null ? (
                <span className={cn("tabular-nums", order.stage === "cancelled" && "text-muted-foreground line-through")}>
                  {formatCurrencyBRL(order.total)}
                </span>
              ) : (
                <span className={cn("tabular-nums", order.stage === "cancelled" ? "text-muted-foreground line-through" : "text-success")}>
                  {formatCurrencyBRL(order.commissionAmount)}
                </span>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function PartnerOrderCard({
  order,
  storeId,
  now,
  onCharge,
}: {
  order: PartnerOrder;
  storeId: string;
  now: number;
  onCharge: () => void;
}) {
  const [cancel, { isLoading: cancelling }] = useCancelPartnerOrderMutation();
  const [deliver, { isLoading: delivering }] = useDeliverPartnerOrderMutation();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [asking, setAsking] = useState(false);
  const minutes = Math.max(0, Math.floor((now - new Date(order.createdAt).getTime()) / 60_000));
  const request = order.cancelRequest;
  const unpaid = order.stage === "awaiting_payment";

  return (
    <motion.article
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      aria-label={`Pedido ${order.number} de ${order.customerName}`}
      className={cn(
        "flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-xs",
        order.stage === "ready" && "border-success/50 bg-success/5",
        order.stage === "with_partner" && "border-primary/50 bg-primary/5",
        unpaid && "border-2 border-dashed border-warning bg-warning/10",
        order.stage === "cancelled" && "opacity-70"
      )}
    >
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xl leading-none font-black tabular-nums">#{order.number}</p>
          <p className="mt-1.5 line-clamp-2 text-xl leading-tight font-bold wrap-break-word">{order.customerName}</p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 text-sm text-muted-foreground tabular-nums">
          <Clock className="size-3.5" /> {minutes} min
        </span>
      </header>

      <OrderLines items={order.items} />

      {unpaid && (
        <p className="flex items-center gap-1.5 rounded-lg bg-warning/15 px-2 py-1.5 text-xs font-semibold text-warning">
          <CreditCard className="size-3.5 shrink-0" /> Aguardando a maquininha · ainda não foi para a cozinha
        </p>
      )}
      {request?.status === "pending" && (
        <p className="rounded-lg bg-warning/15 px-2 py-1.5 text-xs font-medium text-warning">
          Cancelamento pedido: aguardando um gerente da loja.
        </p>
      )}
      {request?.status === "rejected" && order.stage !== "cancelled" && (
        <p className="rounded-lg bg-muted px-2 py-1.5 text-xs">
          Cancelamento recusado{request.decidedBy?.name ? ` por ${request.decidedBy.name}` : ""}
          {request.decisionNote ? `: “${request.decisionNote}”` : "."}
        </p>
      )}

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
        <div className="text-sm">
          <p className="font-semibold tabular-nums">{formatCurrencyBRL(order.total)}</p>
          {order.commissionAmount !== null && (
            <p className={cn("text-xs", order.stage === "cancelled" ? "text-muted-foreground line-through" : "text-success")}>
              Comissão {formatCurrencyBRL(order.commissionAmount)}
              {order.settledAt && " · paga"}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {order.can.charge && (
            <Button size="sm" onClick={onCharge}>
              <SmartphoneNfc /> Cobrar
            </Button>
          )}
          {order.can.deliver && (
            <Button
              size="sm"
              loading={delivering}
              onClick={async () => {
                await deliver({ storeId, orderId: order.id }).unwrap();
                toast.success(`Pedido #${order.number} entregue ao cliente`);
              }}
            >
              <Check /> Entreguei ao cliente
            </Button>
          )}
          {order.can.cancel && (
            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setConfirmCancel(true)}>
              <X /> {unpaid ? "Descartar" : "Cancelar"}
            </Button>
          )}
          {order.can.requestCancel && (
            <Button size="sm" variant="ghost" onClick={() => setAsking(true)}>
              <Undo2 /> Pedir cancelamento
            </Button>
          )}
        </div>
      </footer>

      <AlertDialogDestructive
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        loading={cancelling}
        title={unpaid ? `Descartar o pedido #${order.number}?` : `Cancelar o pedido #${order.number}?`}
        description={
          unpaid
            ? "Nada foi pago e o pedido não foi para a cozinha. Ele sai da lista."
            : "O pedido sai da cozinha da loja e o pagamento na maquininha volta sozinho para o cliente."
        }
        confirmLabel={unpaid ? "Descartar" : "Cancelar pedido"}
        onConfirm={async () => {
          await cancel({ storeId, orderId: order.id }).unwrap();
          setConfirmCancel(false);
          toast.success(`Pedido #${order.number} ${unpaid ? "descartado" : "cancelado"}`);
        }}
      />
      <RequestCancelDialog storeId={storeId} order={asking ? order : null} onClose={() => setAsking(false)} />
    </motion.article>
  );
}

/** Past the partner's window: a manager of the store decides. */
function RequestCancelDialog({
  storeId,
  order: current,
  onClose,
}: {
  storeId: string;
  order: PartnerOrder | null;
  onClose: () => void;
}) {
  const order = useLastValue(current);
  const [reason, setReason] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [request, { isLoading }] = useRequestPartnerCancelMutation();

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!order) return;
    if (reason.trim().length < 3) {
      setInvalid(true);
      return;
    }
    await request({ storeId, orderId: order.id, reason: reason.trim() }).unwrap();
    toast.success("Cancelamento pedido. Um gerente da loja vai responder.");
    onClose();
  };

  return (
    <Dialog
      open={Boolean(current)}
      onOpenChange={(open) => !open && onClose()}
      onOpenChangeComplete={(open) => {
        if (open) return;
        setReason("");
        setInvalid(false);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} noValidate>
          <DialogHeader>
            <DialogTitle>Pedir cancelamento do #{order?.number}</DialogTitle>
            <DialogDescription>
              O pedido já está com a loja. Um gerente decide; até lá a loja segura o pedido.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <Field data-invalid={invalid}>
              <FieldLabel htmlFor="cancel-reason">Motivo</FieldLabel>
              <Textarea
                id="cancel-reason"
                value={reason}
                onChange={(event) => {
                  setReason(event.target.value);
                  if (event.target.value.trim().length >= 3) setInvalid(false);
                }}
                placeholder="Ex.: o cliente desistiu"
                maxLength={300}
                aria-invalid={invalid}
              />
              {invalid && <FieldError>Conte o motivo em poucas palavras.</FieldError>}
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Voltar
            </Button>
            <Button type="submit" loading={isLoading}>
              Pedir cancelamento
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
