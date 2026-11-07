"use client";

import { useEffect, useRef, useState } from "react";
import { Radio } from "@base-ui/react/radio";
import { AnimatePresence, motion } from "motion/react";
import { CircleCheck, CircleX, CreditCard, FlaskConical, QrCode, RotateCcw, Smartphone, Wallet } from "lucide-react";
import type { PointCharge, PointPaymentType } from "@react-menu/contracts";
import { ResponsiveModal } from "@/components/app/responsive-modal";
import { Button } from "@/components/ui/button";
import { RadioGroup } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { useLastValue } from "@/hooks/use-last-value";
import { releaseIdempotencyKey, stableIdempotencyKey } from "@/lib/idempotency";
import { cardRejection } from "@/app/(menu)/_lib/payment-methods";
import { baseApi } from "@/redux/api/baseApi";
import { useAppDispatch } from "@/redux/hooks";
import {
  useCancelPointChargeMutation,
  useChargeOnPointMutation,
  useGetPendingPointChargesQuery,
  useGetPointConfigQuery,
  useLazyGetPointChargeQuery,
  useSimulatePointChargeMutation,
} from "@/redux/features/point/pointApi";
import { formatCurrencyBRL } from "@/utils/string";
import { getErrorMessage } from "@/utils/get-error-message";
import { cn } from "@/lib/utils";

/** "Cliente escolhe": no type, the machine asks. */
type Choice = PointPaymentType | "any";

const CHOICES: Record<Choice, { label: string; icon: typeof CreditCard }> = {
  credit_card: { label: "Crédito", icon: CreditCard },
  debit_card: { label: "Débito", icon: Wallet },
  qr: { label: "Pix / QR", icon: QrCode },
  any: { label: "Cliente escolhe", icon: Smartphone },
};

/** Why a charge didn't go through, for the counter. */
function chargeProblem(charge: PointCharge) {
  if (charge.status === "expired") {
    switch (charge.statusDetail) {
      case "canceled_on_terminal":
        return "Cancelada na maquininha.";
      case "canceled_by_api":
        return "Cobrança cancelada.";
      default:
        return "A cobrança expirou na maquininha.";
    }
  }
  if (charge.statusDetail === "rejected_other_reason") return "Cartão recusado pelo banco. Tente outro cartão.";
  return cardRejection(charge.statusDetail);
}

const POLL_MS = 2000;
/** Every this many polls, ask Mercado Pago too (the webhook may be slow or blocked). */
const CHECK_EVERY = 5;

type ChargeOrder = { id: string; number: number; total: number };

/** A ticket not sent yet: the order is created only on "Enviar para a maquininha". */
type Prepare = { total: number; create: () => Promise<ChargeOrder> };

interface PointChargeDialogProps {
  storeId: string;
  /** The order to charge (null and no `prepare`: closed). */
  order: ChargeOrder | null;
  /** The POS ticket: nothing is created until the charge is sent. */
  prepare?: Prepare | null;
  /** A charge already waiting on the machine: open straight on it. */
  resume?: PointCharge | null;
  onClose: () => void;
  /** After the machine approved it. */
  onPaid?: () => void;
}

/**
 * "Cobrar na maquininha" (ADR 0020): picks how, sends the order's total to
 * the store's Mercado Pago Point machine, and follows it until the customer
 * pays, the card is refused or the charge is cancelled.
 */
export function PointChargeDialog({
  storeId,
  order: current,
  prepare: currentPrepare,
  resume,
  onClose,
  onPaid,
}: PointChargeDialogProps) {
  const open = Boolean(current || currentPrepare);
  const order = useLastValue(current, () => open);
  const prepare = useLastValue(currentPrepare ?? null, () => open);
  const resumed = useLastValue(resume ?? null);
  // From the POS ticket: the order the dialog created (for the title).
  const [created, setCreated] = useState<ChargeOrder | null>(null);
  const titled = order ?? created;
  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(next) => !next && onClose()}
      onOpenChangeComplete={(next) => !next && setCreated(null)}
      title={titled ? `Cobrar pedido #${titled.number}` : "Cobrar na maquininha"}
      description="Envie o valor para a maquininha do Mercado Pago."
      // A stray tap outside must not lose the charge: only its buttons close it.
      dismissible={false}
      className="sm:max-w-md"
    >
      {(order || prepare) && (
        <ChargeFlow
          key={order?.id ?? "new"}
          storeId={storeId}
          given={order ?? null}
          prepare={order ? null : prepare}
          resume={order && resumed?.order.id === order.id ? resumed : null}
          onCreated={setCreated}
          onClose={onClose}
          onPaid={onPaid}
        />
      )}
    </ResponsiveModal>
  );
}

function ChargeFlow({
  storeId,
  given,
  prepare,
  resume,
  onCreated,
  onClose,
  onPaid,
}: {
  storeId: string;
  onCreated: (order: ChargeOrder) => void;
  given: ChargeOrder | null;
  prepare: Prepare | null;
  resume: PointCharge | null;
  onClose: () => void;
  onPaid?: () => void;
}) {
  const dispatch = useAppDispatch();
  // From the POS ticket, the order exists once "Enviar para a maquininha" created it.
  const [created, setCreated] = useState<ChargeOrder | null>(null);
  const order = given ?? created;
  const total = order?.total ?? prepare?.total ?? 0;
  const [creating, setCreating] = useState(false);
  const { data: config } = useGetPointConfigQuery(storeId);
  const [send, { isLoading: sending }] = useChargeOnPointMutation();
  const [follow] = useLazyGetPointChargeQuery();
  const [cancel, { isLoading: cancelling }] = useCancelPointChargeMutation();
  const [simulate, { isLoading: simulating }] = useSimulatePointChargeMutation();

  const types = config?.paymentTypes ?? [];
  const choices: Choice[] = [...types, ...(types.length > 1 ? (["any"] as const) : [])];
  const [choice, setChoice] = useState<Choice | null>(null);
  const picked = choice ?? choices[0] ?? "any";
  const [installments, setInstallments] = useState(1);
  const [terminalId, setTerminalId] = useState<string | null>(null);
  const terminals = config?.terminals ?? [];
  const terminal = terminalId ?? terminals[0]?.id ?? null;
  const terminalName = terminals.find((candidate) => candidate.id === terminal)?.name;

  const [own, setCharge] = useState<PointCharge | null>(resume);
  const [error, setError] = useState<string | null>(null);
  /** The machine is busy with another order's charge. */
  const [busy, setBusy] = useState<{ orderId: string; orderNumber: number; paymentId: string } | null>(null);

  // Opened on an order whose charge is already on the machine: follow that one.
  const { data: waiting } = useGetPendingPointChargesQuery({ storeId });
  const waitingHere = (order && waiting?.find((candidate) => candidate.order.id === order.id)) ?? null;
  const charge = own ?? waitingHere;

  // Follow the charge while it waits on the machine.
  const polls = useRef(0);
  useEffect(() => {
    if (charge?.status !== "pending") return;
    const orderId = charge.order.id;
    const timer = setInterval(async () => {
      polls.current += 1;
      const result = await follow({
        storeId,
        orderId,
        paymentId: charge.id,
        check: polls.current % CHECK_EVERY === 0,
      });
      if (result.data && result.data.status !== "pending") {
        setCharge(result.data);
        dispatch(baseApi.util.invalidateTags([{ type: "PointConfig", id: `charges-${storeId}` }]));
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [charge?.id, charge?.order.id, charge?.status, dispatch, follow, storeId]);

  // Paid: the board and the order show it at once.
  const settled = charge?.status;
  const settledOrder = charge?.order.id;
  useEffect(() => {
    if (settled !== "approved" || !settledOrder) return;
    dispatch(
      baseApi.util.invalidateTags([
        { type: "Order", id: `store-${storeId}` },
        { type: "Order", id: settledOrder },
      ])
    );
    onPaid?.();
  }, [dispatch, onPaid, settled, settledOrder, storeId]);

  const start = async () => {
    setError(null);
    setBusy(null);
    let target = order;
    if (!target) {
      // The ticket becomes an order now (it goes to the kitchen, as "Enviar" does).
      setCreating(true);
      try {
        target = await prepare!.create();
        setCreated(target);
        onCreated(target);
      } catch (err) {
        setError(getErrorMessage(err as { data?: { error?: string } }, "Não foi possível criar o pedido."));
        return;
      } finally {
        setCreating(false);
      }
    }
    const input = {
      terminalId: terminal ?? undefined,
      paymentType: picked === "any" ? null : picked,
      installments: picked === "credit_card" ? installments : undefined,
    };
    // A dropped connection resent with the same key never charges twice.
    const scope = `point:${target.id}`;
    try {
      const sent = await send({
        storeId,
        orderId: target.id,
        input,
        idempotencyKey: stableIdempotencyKey(scope, input),
      }).unwrap();
      releaseIdempotencyKey(scope);
      polls.current = 0;
      setCharge(sent);
    } catch (err) {
      const data = (err as { data?: { code?: string; details?: typeof busy } }).data;
      if (data?.code === "E_TERMINAL_BUSY" && data.details) setBusy(data.details);
      setError(getErrorMessage(err as { data?: { error?: string } }, "Não foi possível enviar para a maquininha."));
    }
  };

  /** Frees the machine: cancels the other order's charge (only while it isn't on its screen). */
  const freeMachine = async () => {
    if (!busy) return;
    try {
      await cancel({ storeId, orderId: busy.orderId, paymentId: busy.paymentId }).unwrap();
      setBusy(null);
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err as { data?: { error?: string } }, "Não foi possível cancelar aquela cobrança."));
    }
  };

  const stop = async () => {
    if (!charge) return;
    setError(null);
    try {
      setCharge(await cancel({ storeId, orderId: charge.order.id, paymentId: charge.id }).unwrap());
    } catch (err) {
      setError(getErrorMessage(err as { data?: { error?: string } }, "Não foi possível cancelar a cobrança."));
    }
  };

  const answer = async (approve: boolean) => {
    if (!charge) return;
    setCharge(await simulate({ storeId, orderId: charge.order.id, paymentId: charge.id, approve }).unwrap());
  };

  const step = !charge ? "choose" : charge.status;

  return (
    <div className="flex flex-col gap-5 p-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-muted-foreground">
          {order ? `Total do pedido #${order.number}` : "Total do ticket"}
        </span>
        <span className="text-2xl font-bold tabular-nums">{formatCurrencyBRL(total)}</span>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.15 }}
          className="flex flex-col gap-4"
        >
          {step === "choose" && (
            <>
              <RadioGroup
                aria-label="Forma de pagamento na maquininha"
                value={picked}
                onValueChange={(value) => setChoice(value as Choice)}
                className="grid grid-cols-2 gap-2"
              >
                {choices.map((value) => {
                  const { label, icon: Icon } = CHOICES[value];
                  return (
                    <Radio.Root
                      key={value}
                      value={value}
                      className="flex h-16 flex-col items-center justify-center gap-1 rounded-xl border text-sm font-medium transition-colors outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 data-checked:border-primary data-checked:bg-primary/5 data-checked:text-primary"
                    >
                      <Icon className="size-5" /> {label}
                    </Radio.Root>
                  );
                })}
              </RadioGroup>

              {picked === "credit_card" && (config?.maxInstallments ?? 1) > 1 && (
                <label className="flex items-center justify-between gap-3 text-sm">
                  Parcelas
                  <Select
                    items={Array.from({ length: config!.maxInstallments }, (_, index) => ({
                      value: String(index + 1),
                      label: index === 0 ? "À vista" : `${index + 1}x`,
                    }))}
                    value={String(installments)}
                    onValueChange={(value) => setInstallments(Number(value))}
                  >
                    <SelectTrigger className="w-32" aria-label="Parcelas">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: config!.maxInstallments }, (_, index) => (
                        <SelectItem key={index} value={String(index + 1)}>
                          {index === 0 ? "À vista" : `${index + 1}x`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
              )}

              {terminals.length > 1 && (
                <label className="flex items-center justify-between gap-3 text-sm">
                  Maquininha
                  <Select
                    items={terminals.map((option) => ({ value: option.id, label: option.name }))}
                    value={terminal ?? undefined}
                    onValueChange={(value) => setTerminalId(value as string)}
                  >
                    <SelectTrigger className="w-44" aria-label="Maquininha">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {terminals.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
              )}

              {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
              {busy && (
                <Button variant="outline" loading={cancelling} onClick={() => void freeMachine()}>
                  Cancelar a cobrança do pedido #{busy.orderNumber}
                </Button>
              )}
              <Button
                size="lg"
                className="h-12 rounded-xl text-base"
                loading={sending || creating}
                onClick={() => void start()}
              >
                <CreditCard /> Enviar para a maquininha{terminalName ? ` (${terminalName})` : ""}
              </Button>
              <Button variant="ghost" disabled={sending || creating} onClick={onClose}>
                {order ? "Cobrar depois" : "Voltar ao ticket"}
              </Button>
            </>
          )}

          {step === "pending" && (
            <>
              <div role="status" className="flex flex-col items-center gap-3 py-4 text-center">
                <Spinner className="size-8 text-primary" aria-hidden />
                <p className="font-semibold">Aguardando pagamento na maquininha</p>
                <p className="text-sm text-muted-foreground">
                  {(charge?.terminalName ?? terminalName) ? `${charge?.terminalName ?? terminalName}: ` : ""}o cliente
                  passa ou aproxima o cartão. Pode fechar esta janela: a cobrança continua e fica na barra
                  “Na maquininha” do PDV.
                </p>
              </div>
              {charge?.simulated && (
                <div className="flex flex-wrap items-center justify-center gap-2 rounded-xl border border-dashed p-3">
                  <FlaskConical className="size-4 text-muted-foreground" />
                  <Button size="sm" variant="outline" loading={simulating} onClick={() => void answer(true)}>
                    Simular aprovação
                  </Button>
                  <Button size="sm" variant="ghost" disabled={simulating} onClick={() => void answer(false)}>
                    Simular recusa
                  </Button>
                </div>
              )}
              {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" loading={cancelling} onClick={() => void stop()}>
                  Cancelar cobrança
                </Button>
                {/* The charge goes on: it stays in the "Na maquininha" bar. */}
                <Button variant="ghost" className="flex-1" onClick={onClose}>
                  Continuar depois
                </Button>
              </div>
            </>
          )}

          {step === "approved" && (
            <>
              <div role="status" className="flex flex-col items-center gap-2 py-4 text-center">
                <CircleCheck className="size-12 text-success" aria-hidden />
                <p className="text-lg font-semibold">Pagamento aprovado</p>
                <p className="text-sm text-muted-foreground">O pedido #{charge?.order.number} está pago.</p>
              </div>
              <Button size="lg" className="h-12 rounded-xl" onClick={onClose}>
                Concluir
              </Button>
            </>
          )}

          {(step === "rejected" || step === "expired" || step === "refunded") && charge && (
            <>
              <div role="alert" className="flex flex-col items-center gap-2 py-4 text-center">
                <CircleX className={cn("size-12", step === "rejected" ? "text-destructive" : "text-muted-foreground")} aria-hidden />
                <p className="text-lg font-semibold">{step === "rejected" ? "Pagamento recusado" : "Cobrança encerrada"}</p>
                <p className="text-sm text-muted-foreground">{chargeProblem(charge)}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={onClose}>
                  Fechar
                </Button>
                <Button className="flex-1" onClick={() => setCharge(null)}>
                  <RotateCcw /> Tentar de novo
                </Button>
              </div>
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
