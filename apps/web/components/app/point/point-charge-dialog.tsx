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

interface PointChargeDialogProps {
  storeId: string;
  /** The order to charge; null closes the dialog. */
  order: { id: string; number: number; total: number } | null;
  onClose: () => void;
  /** After the machine approved it. */
  onPaid?: () => void;
}

/**
 * "Cobrar na maquininha" (ADR 0020): picks how, sends the order's total to
 * the store's Mercado Pago Point machine, and follows it until the customer
 * pays, the card is refused or the charge is cancelled.
 */
export function PointChargeDialog({ storeId, order: current, onClose, onPaid }: PointChargeDialogProps) {
  const order = useLastValue(current);
  return (
    <ResponsiveModal
      open={Boolean(current)}
      onOpenChange={(open) => !open && onClose()}
      title={order ? `Cobrar pedido #${order.number}` : "Cobrar na maquininha"}
      description="Envie o valor para a maquininha do Mercado Pago."
      className="sm:max-w-md"
    >
      {order && <ChargeFlow key={order.id} storeId={storeId} order={order} onClose={onClose} onPaid={onPaid} />}
    </ResponsiveModal>
  );
}

function ChargeFlow({
  storeId,
  order,
  onClose,
  onPaid,
}: {
  storeId: string;
  order: { id: string; number: number; total: number };
  onClose: () => void;
  onPaid?: () => void;
}) {
  const dispatch = useAppDispatch();
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

  const [charge, setCharge] = useState<PointCharge | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Follow the charge while it waits on the machine.
  const polls = useRef(0);
  useEffect(() => {
    if (charge?.status !== "pending") return;
    const timer = setInterval(async () => {
      polls.current += 1;
      const result = await follow({
        storeId,
        orderId: order.id,
        paymentId: charge.id,
        check: polls.current % CHECK_EVERY === 0,
      });
      if (result.data && result.data.status !== "pending") setCharge(result.data);
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [charge?.id, charge?.status, follow, order.id, storeId]);

  // Paid: the board and the order show it at once.
  const settled = charge?.status;
  useEffect(() => {
    if (settled !== "approved") return;
    dispatch(
      baseApi.util.invalidateTags([
        { type: "Order", id: `store-${storeId}` },
        { type: "Order", id: order.id },
      ])
    );
    onPaid?.();
  }, [dispatch, onPaid, order.id, settled, storeId]);

  const start = async () => {
    setError(null);
    const input = {
      terminalId: terminal ?? undefined,
      paymentType: picked === "any" ? null : picked,
      installments: picked === "credit_card" ? installments : undefined,
    };
    // A dropped connection resent with the same key never charges twice.
    const scope = `point:${order.id}`;
    try {
      const sent = await send({
        storeId,
        orderId: order.id,
        input,
        idempotencyKey: stableIdempotencyKey(scope, input),
      }).unwrap();
      releaseIdempotencyKey(scope);
      polls.current = 0;
      setCharge(sent);
    } catch (err) {
      setError(getErrorMessage(err as { data?: { error?: string } }, "Não foi possível enviar para a maquininha."));
    }
  };

  const stop = async () => {
    if (!charge) return;
    setError(null);
    try {
      setCharge(await cancel({ storeId, orderId: order.id, paymentId: charge.id }).unwrap());
    } catch (err) {
      setError(getErrorMessage(err as { data?: { error?: string } }, "Não foi possível cancelar a cobrança."));
    }
  };

  const answer = async (approve: boolean) => {
    if (!charge) return;
    setCharge(await simulate({ storeId, orderId: order.id, paymentId: charge.id, approve }).unwrap());
  };

  const step = !charge ? "choose" : charge.status;

  return (
    <div className="flex flex-col gap-5 p-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-muted-foreground">Total do pedido #{order.number}</span>
        <span className="text-2xl font-bold tabular-nums">{formatCurrencyBRL(order.total)}</span>
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
              <Button size="lg" className="h-12 rounded-xl text-base" loading={sending} onClick={() => void start()}>
                <CreditCard /> Enviar para a maquininha{terminalName ? ` (${terminalName})` : ""}
              </Button>
            </>
          )}

          {step === "pending" && (
            <>
              <div role="status" className="flex flex-col items-center gap-3 py-4 text-center">
                <Spinner className="size-8 text-primary" aria-hidden />
                <p className="font-semibold">Aguardando pagamento na maquininha</p>
                <p className="text-sm text-muted-foreground">
                  {terminalName ? `${terminalName}: ` : ""}o cliente passa ou aproxima o cartão. Esta tela atualiza
                  sozinha.
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
              <Button variant="outline" loading={cancelling} onClick={() => void stop()}>
                Cancelar cobrança
              </Button>
            </>
          )}

          {step === "approved" && (
            <>
              <div role="status" className="flex flex-col items-center gap-2 py-4 text-center">
                <CircleCheck className="size-12 text-success" aria-hidden />
                <p className="text-lg font-semibold">Pagamento aprovado</p>
                <p className="text-sm text-muted-foreground">O pedido #{order.number} está pago.</p>
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
