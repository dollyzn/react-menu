"use client";

import { useEffect, useRef, useState } from "react";
import { Radio } from "@base-ui/react/radio";
import { AnimatePresence, motion } from "motion/react";
import {
  Check,
  CircleCheck,
  CircleX,
  Clock,
  CreditCard,
  FlaskConical,
  QrCode,
  RotateCcw,
  SmartphoneNfc,
  TriangleAlert,
  Wallet,
  X,
} from "lucide-react";
import type { PointCharge, PointPaymentType } from "@react-menu/contracts";
import { ResponsiveModal } from "@/components/app/responsive-modal";
import { Button } from "@/components/ui/button";
import { RadioGroup } from "@/components/ui/radio-group";
import { useLastValue } from "@/hooks/use-last-value";
import { useNow } from "@/hooks/use-now";
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

type Choice = PointPaymentType;

const CHOICES: Record<Choice, { label: string; hint: string; icon: typeof CreditCard }> = {
  credit_card: { label: "Crédito", hint: "À vista", icon: CreditCard },
  debit_card: { label: "Débito", hint: "Na hora", icon: Wallet },
  qr: { label: "Pix / QR", hint: "QR no visor", icon: QrCode },
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
      // The flow draws its own top (the amount first); the title stays for screen readers.
      hideHeader
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
  const choices: Choice[] = types;
  const [choice, setChoice] = useState<Choice | null>(null);
  const picked: Choice = choice ?? choices[0] ?? "credit_card";
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
      paymentType: picked,
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
  const machine = charge?.terminalName ?? terminalName ?? "maquininha";
  const perInstallment = picked === "credit_card" && installments > 1 ? total / installments : null;

  return (
    <div className="flex flex-col">
      {/* The amount first: it is what the counter checks against the machine. */}
      <header className="flex flex-col items-center gap-2 px-4 pt-6 pb-5 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
          <SmartphoneNfc className="size-3.5" />
          {(charge?.order ?? order) ? `Pedido #${(charge?.order ?? order)!.number}` : "Novo pedido"}
          <span aria-hidden>·</span>
          {machine}
        </span>
        <p className="text-4xl font-black tracking-tight tabular-nums">{formatCurrencyBRL(total)}</p>
        {step === "choose" && perInstallment && (
          <p className="text-sm text-muted-foreground">
            em {installments}x de {formatCurrencyBRL(perInstallment)}
          </p>
        )}
      </header>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
          className="flex flex-col"
        >
          {step === "choose" && (
            <>
              <div className="flex flex-col gap-5 px-4 pb-4">
                <fieldset className="flex flex-col gap-2">
                  <legend className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    Como o cliente vai pagar
                  </legend>
                  <RadioGroup
                    aria-label="Forma de pagamento na maquininha"
                    value={picked}
                    onValueChange={(value) => setChoice(value as Choice)}
                    className="grid grid-cols-2 gap-2"
                  >
                    {choices.map((value) => {
                      const { label, hint, icon: Icon } = CHOICES[value];
                      return (
                        <Radio.Root
                          key={value}
                          value={value}
                          aria-label={label}
                          className="group relative flex items-center gap-3 rounded-2xl border bg-card p-3 text-left transition-all outline-none hover:border-primary/40 focus-visible:ring-3 focus-visible:ring-ring/50 data-checked:border-primary data-checked:bg-primary/5 data-checked:shadow-sm"
                        >
                          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground transition-colors group-data-checked:bg-primary group-data-checked:text-primary-foreground">
                            <Icon className="size-5" />
                          </span>
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold">{label}</span>
                            <span className="block text-xs leading-tight text-muted-foreground">
                              {value === "credit_card" && (config?.maxInstallments ?? 1) > 1
                                ? `Até ${config!.maxInstallments}x`
                                : hint}
                            </span>
                          </span>
                          <span className="absolute top-2 right-2 hidden size-4 items-center justify-center rounded-full bg-primary text-primary-foreground group-data-checked:flex">
                            <Check className="size-3" strokeWidth={3} />
                          </span>
                        </Radio.Root>
                      );
                    })}
                  </RadioGroup>
                </fieldset>

                {picked === "credit_card" && (config?.maxInstallments ?? 1) > 1 && (
                  <fieldset className="flex flex-col gap-2">
                    <legend className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      Parcelas
                    </legend>
                    <RadioGroup
                      aria-label="Parcelas"
                      value={String(installments)}
                      onValueChange={(value) => setInstallments(Number(value))}
                      className="flex flex-wrap gap-2"
                    >
                      {Array.from({ length: config!.maxInstallments }, (_, index) => index + 1).map((count) => (
                        <Radio.Root
                          key={count}
                          value={String(count)}
                          className="flex flex-col items-start rounded-xl border px-3 py-2 text-left transition-colors outline-none hover:border-primary/40 focus-visible:ring-3 focus-visible:ring-ring/50 data-checked:border-primary data-checked:bg-primary/5"
                        >
                          <span className="text-sm font-semibold">{count === 1 ? "À vista" : `${count}x`}</span>
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {count === 1 ? formatCurrencyBRL(total) : `de ${formatCurrencyBRL(total / count)}`}
                          </span>
                        </Radio.Root>
                      ))}
                    </RadioGroup>
                  </fieldset>
                )}

                {terminals.length > 1 && (
                  <fieldset className="flex flex-col gap-2">
                    <legend className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      Maquininha
                    </legend>
                    <RadioGroup
                      aria-label="Maquininha"
                      value={terminal ?? undefined}
                      onValueChange={(value) => setTerminalId(value as string)}
                      className="flex flex-wrap gap-2"
                    >
                      {terminals.map((option) => (
                        <Radio.Root
                          key={option.id}
                          value={option.id}
                          className="flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors outline-none hover:border-primary/40 focus-visible:ring-3 focus-visible:ring-ring/50 data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground"
                        >
                          <SmartphoneNfc className="size-4" /> {option.name}
                        </Radio.Root>
                      ))}
                    </RadioGroup>
                  </fieldset>
                )}

                {error && (
                  <div role="alert" className="flex flex-col gap-2 rounded-2xl bg-destructive/10 p-3 text-sm text-destructive">
                    <p className="flex items-start gap-2">
                      <TriangleAlert className="mt-0.5 size-4 shrink-0" /> {error}
                    </p>
                    {busy && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="self-start border-destructive/40 bg-background text-destructive hover:bg-destructive/10"
                        loading={cancelling}
                        onClick={() => void freeMachine()}
                      >
                        Cancelar a cobrança do pedido #{busy.orderNumber}
                      </Button>
                    )}
                  </div>
                )}
              </div>

              <Footer>
                <Button
                  size="lg"
                  className="h-12 w-full rounded-xl text-base shadow-sm"
                  loading={sending || creating}
                  onClick={() => void start()}
                >
                  <SmartphoneNfc /> Cobrar {formatCurrencyBRL(total)} na {machine}
                </Button>
                <Button variant="ghost" className="w-full" disabled={sending || creating} onClick={onClose}>
                  {order ? "Cobrar depois" : "Voltar ao ticket"}
                </Button>
              </Footer>
            </>
          )}

          {step === "pending" && charge && (
            <>
              <div className="flex flex-col items-center gap-4 px-4 pb-5 text-center">
                <MachineWaiting />
                <div role="status" className="flex flex-col gap-1">
                  <p className="text-lg font-semibold">Aguardando pagamento na maquininha</p>
                  <p className="text-sm text-balance text-muted-foreground">
                    Peça para o cliente inserir ou aproximar o cartão na {machine}.
                  </p>
                </div>
                <Progress steps={["Enviado", "Na maquininha", "Pago"]} current={1} />
                <Countdown until={charge.expiresAt} />
                {charge.simulated && (
                  <div className="flex w-full flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-xl bg-muted/60 px-3 py-2 text-xs text-muted-foreground sm:justify-between">
                    <span className="flex items-center gap-1.5 whitespace-nowrap">
                      <FlaskConical className="size-3.5" /> Teste
                    </span>
                    <span className="flex gap-1">
                      <Button size="xs" variant="outline" loading={simulating} onClick={() => void answer(true)}>
                        Simular aprovação
                      </Button>
                      <Button size="xs" variant="ghost" disabled={simulating} onClick={() => void answer(false)}>
                        Simular recusa
                      </Button>
                    </span>
                  </div>
                )}
                {error && (
                  <p role="alert" className="text-sm text-destructive">
                    {error}
                  </p>
                )}
              </div>
              <Footer hint="A cobrança continua na maquininha e fica na barra “Na maquininha”.">
                <div className="grid w-full grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    className="h-11 rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive"
                    loading={cancelling}
                    onClick={() => void stop()}
                  >
                    <X /> Cancelar cobrança
                  </Button>
                  <Button variant="secondary" className="h-11 rounded-xl" onClick={onClose}>
                    Continuar depois
                  </Button>
                </div>
              </Footer>
            </>
          )}

          {step === "approved" && charge && (
            <>
              <Outcome
                tone="success"
                title="Pagamento aprovado"
                text={`Pedido #${charge.order.number} pago na ${machine}.`}
              />
              <Footer>
                <Button size="lg" className="h-12 w-full rounded-xl text-base" onClick={onClose}>
                  Concluir
                </Button>
              </Footer>
            </>
          )}

          {(step === "rejected" || step === "expired" || step === "refunded") && charge && (
            <>
              <Outcome
                tone={step === "rejected" ? "danger" : "muted"}
                title={step === "rejected" ? "Pagamento recusado" : "Cobrança encerrada"}
                text={chargeProblem(charge)}
              />
              <Footer>
                <Button size="lg" className="h-12 w-full rounded-xl text-base" onClick={() => setCharge(null)}>
                  <RotateCcw /> Tentar de novo
                </Button>
                <Button variant="ghost" className="w-full" onClick={onClose}>
                  Agora não
                </Button>
              </Footer>
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/** The dialog's bottom: actions (and a line of context), apart from the content. */
function Footer({ hint, children }: { hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 border-t bg-muted/30 p-4">
      {children}
      {hint && <p className="text-center text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** A card machine with waves going out: the charge is on its screen. */
function MachineWaiting() {
  return (
    <div className="relative flex size-28 items-center justify-center" aria-hidden>
      {[0, 0.6, 1.2].map((delay) => (
        <motion.span
          key={delay}
          className="absolute inset-4 rounded-full border-2 border-primary/40"
          initial={{ scale: 0.8, opacity: 0.6 }}
          animate={{ scale: 1.5, opacity: 0 }}
          transition={{ duration: 1.8, repeat: Infinity, delay, ease: "easeOut" }}
        />
      ))}
      <span className="relative flex size-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/30">
        <SmartphoneNfc className="size-8" />
      </span>
    </div>
  );
}

/** Enviado → Na maquininha → Pago. */
function Progress({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex w-full items-center gap-2" aria-label="Andamento da cobrança">
      {steps.map((label, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li key={label} className="flex flex-1 flex-col items-center gap-1.5">
            <span
              className={cn(
                "h-1.5 w-full rounded-full bg-muted",
                done && "bg-primary",
                active && "animate-pulse bg-primary/60"
              )}
            />
            <span className={cn("text-[11px] text-muted-foreground", (done || active) && "font-medium text-foreground")}>
              {label}
              {active && <span className="sr-only"> (agora)</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** "Expira em 9:41": Mercado Pago drops the charge then. */
function Countdown({ until }: { until: string | null }) {
  const now = useNow(1000);
  if (!until) return null;
  const left = Math.max(0, Math.floor((new Date(until).getTime() - now) / 1000));
  return (
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
      <Clock className="size-3.5" /> Expira em {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}
    </p>
  );
}

/** How it ended: paid, refused, cancelled. */
function Outcome({ tone, title, text }: { tone: "success" | "danger" | "muted"; title: string; text: string }) {
  const Icon = tone === "success" ? CircleCheck : CircleX;
  return (
    <div role={tone === "success" ? "status" : "alert"} className="flex flex-col items-center gap-3 px-4 pb-6 text-center">
      <motion.span
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 18 }}
        className={cn(
          "flex size-20 items-center justify-center rounded-full",
          tone === "success" && "bg-success/10 text-success",
          tone === "danger" && "bg-destructive/10 text-destructive",
          tone === "muted" && "bg-muted text-muted-foreground"
        )}
      >
        <Icon className="size-10" />
      </motion.span>
      <p className="text-lg font-semibold">{title}</p>
      <p className="max-w-72 text-sm text-balance text-muted-foreground">{text}</p>
    </div>
  );
}
