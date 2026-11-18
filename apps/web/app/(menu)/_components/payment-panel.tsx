"use client";

import { useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import dynamic from "next/dynamic";
import { QRCodeSVG } from "qrcode.react";
import { AlertTriangle, Check, Copy, FlaskConical, Lock, QrCode } from "lucide-react";
import type { CardFees, OnlinePaymentMethod, PublicOrder, PublicPaymentRequest } from "@react-menu/contracts";
import { Radio } from "@base-ui/react/radio";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useNow } from "@/hooks/use-now";
import { randomId, releaseIdempotencyKey, stableIdempotencyKey } from "@/lib/idempotency";
import { publicApi, usePayOrderMutation, useSimulatePaymentMutation } from "@/redux/features/public/publicApi";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { rememberEmail } from "@/redux/slices/customer";
import { useCopied } from "@/hooks/use-copied";
import { errorCode, getErrorMessage, isConnectionError } from "@/utils/get-error-message";
import { formatCurrencyBRL } from "@/utils/string";
import { cardFee, formatPercent, withCardFee, type CardType } from "@/lib/card-fee";
import { CHECKOUT_METHODS, cardRejection } from "../_lib/payment-methods";
import { CardChallenge } from "./card-challenge";

const CardPaymentForm = dynamic(() => import("./card-payment-form"), {
  ssr: false,
  loading: () => <Skeleton className="h-80 rounded-2xl" />,
});

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const errorText = (error: unknown) =>
  isConnectionError(error)
    ? "A conexão caiu. Tente de novo: nada é cobrado duas vezes."
    : getErrorMessage(error as { data?: { error?: string } }, "Não foi possível iniciar o pagamento.");

/**
 * Pays an order waiting for payment, right on its page (ADR 0015): each
 * online method is a panel; the store's gateway decides which are offered.
 */
export function PaymentPanel({ order }: { order: PublicOrder }) {
  const checkout = order.checkout;
  const initial: OnlinePaymentMethod =
    order.payment?.method ??
    (order.paymentMethod === "pix" || order.paymentMethod === "card" ? order.paymentMethod : "pix");
  const [chosen, setChosen] = useState<OnlinePaymentMethod>(initial);
  if (!checkout || checkout.methods.length === 0) return null;
  const method = checkout.methods.includes(chosen) ? chosen : checkout.methods[0];

  return (
    <section aria-labelledby="payment-title" className="mt-6 rounded-2xl border bg-card p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="payment-title" className="font-semibold">
          Pagamento
        </h2>
        <span className="text-lg font-bold tabular-nums">{formatCurrencyBRL(order.total)}</span>
      </div>

      {checkout.methods.length > 1 && (
        <RadioGroup
          aria-label="Forma de pagamento"
          value={method}
          onValueChange={(value) => setChosen(value as OnlinePaymentMethod)}
          className="mt-3 grid-cols-2"
        >
          {checkout.methods.map((value) => {
            const { label, icon: Icon } = CHECKOUT_METHODS[value];
            return (
              // A segment, not a dot: same radio semantics (arrow keys) as the shadcn RadioGroupItem.
              <Radio.Root
                key={value}
                value={value}
                className="flex items-center justify-center gap-2 rounded-xl border p-2.5 text-sm font-medium transition-colors outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 data-checked:border-primary data-checked:bg-primary/5 data-checked:text-primary"
              >
                <Icon className="size-4" /> {label}
              </Radio.Root>
            );
          })}
        </RadioGroup>
      )}

      <div className="mt-4">
        {method === "pix" ? (
          <PixPayment order={order} />
        ) : (
          <CardPayment
            order={order}
            publicKey={checkout.mercadoPagoPublicKey}
            maxInstallments={checkout.maxInstallments}
            cardFees={checkout.cardFees ?? null}
          />
        )}
      </div>

      <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <Lock className="size-3" /> Pagamento processado pelo Mercado Pago
      </p>
    </section>
  );
}

function PixPayment({ order }: { order: PublicOrder }) {
  const { copied, copy } = useCopied();
  const dispatch = useAppDispatch();
  const savedEmail = useAppSelector((state) => state.customer.email) ?? "";
  const [email, setEmail] = useState(savedEmail);
  const [error, setError] = useState<string | null>(null);
  const [pay, { isLoading }] = usePayOrderMutation();
  const [simulate, { isLoading: simulating }] = useSimulatePaymentMutation();
  const now = useNow(1000);

  const payment = order.payment?.method === "pix" ? order.payment : null;
  const pix = payment?.pix;
  const expiresAt = pix?.expiresAt ? new Date(pix.expiresAt).getTime() : null;
  const secondsLeft = expiresAt ? Math.max(0, Math.floor((expiresAt - now) / 1000)) : null;
  const expired = payment?.status === "expired" || secondsLeft === 0;

  const generate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!EMAIL.test(email.trim())) {
      setError("Informe um e-mail válido.");
      return;
    }
    setError(null);
    const input: PublicPaymentRequest = { method: "pix", payer: { email: email.trim() } };
    const scope = `pay:${order.publicToken}:pix`;
    try {
      await pay({
        token: order.publicToken,
        input,
        idempotencyKey: stableIdempotencyKey(scope, input),
      }).unwrap();
      releaseIdempotencyKey(scope);
      dispatch(rememberEmail(email.trim()));
    } catch (err) {
      setError(errorText(err));
    }
  };

  if (pix && !expired) {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="rounded-2xl bg-white p-3 shadow-sm" role="img" aria-label="QR Code do Pix">
          <QRCodeSVG value={pix.qrCode} size={208} marginSize={0} />
        </div>
        <p className="text-sm text-muted-foreground">
          Abra o app do seu banco, escolha <strong>Pix › Ler QR Code</strong> ou use o código abaixo.
        </p>
        <div className="flex w-full items-center gap-2 rounded-xl border bg-muted/40 p-2">
          <code className="min-w-0 flex-1 truncate text-left text-xs" title={pix.qrCode}>
            {pix.qrCode}
          </code>
          <Button size="sm" className="min-w-24" onClick={() => void copy(pix.qrCode)}>
            {copied ? <Check /> : <Copy />} {copied ? "Copiado!" : "Copiar"}
          </Button>
        </div>
        <p className="flex items-center gap-2 text-sm font-medium" aria-live="polite">
          <Spinner className="text-primary" aria-hidden />
          Aguardando o pagamento… a confirmação aparece aqui sozinha.
        </p>
        {secondsLeft !== null && (
          <p className="text-xs text-muted-foreground tabular-nums">
            Expira em {String(Math.floor(secondsLeft / 60)).padStart(2, "0")}:
            {String(secondsLeft % 60).padStart(2, "0")}
          </p>
        )}
        {payment?.simulated && (
          <Button
            variant="outline"
            size="sm"
            loading={simulating}
            onClick={() => void simulate(order.publicToken)}
          >
            <FlaskConical /> Simular pagamento aprovado (modo de teste)
          </Button>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={generate} className="flex flex-col gap-3">
      {expired && (
        <Alert>
          <AlertTriangle />
          <AlertDescription>Este Pix expirou. Gere um novo para pagar.</AlertDescription>
        </Alert>
      )}
      <Field>
        <FieldLabel htmlFor="pix-email">Seu e-mail</FieldLabel>
        <Input
          id="pix-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="voce@exemplo.com"
        />
        <FieldDescription>Enviamos o recibo do pedido para este e-mail.</FieldDescription>
      </Field>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" size="lg" className="w-full rounded-full" loading={isLoading}>
        <QrCode /> Gerar Pix
      </Button>
    </form>
  );
}

const CARD_TYPES: { value: CardType; label: string; paymentType: "credit_card" | "debit_card" }[] = [
  { value: "credit", label: "Crédito", paymentType: "credit_card" },
  { value: "debit", label: "Débito", paymentType: "debit_card" },
];

function CardPayment({
  order,
  publicKey,
  maxInstallments,
  cardFees,
}: {
  order: PublicOrder;
  publicKey: string | null;
  maxInstallments: number;
  /** The store passes the card fee on: the customer picks the type to see it. */
  cardFees: CardFees | null;
}) {
  const dispatch = useAppDispatch();
  const savedEmail = useAppSelector((state) => state.customer.email);
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<CardType>("credit");
  const [pay] = usePayOrderMutation();
  const payment = order.payment?.method === "card" ? order.payment : null;

  if (!publicKey) return null;

  const fee = cardFees ? cardFee(order.total, cardFees[type]) : 0;
  const amount = cardFees ? withCardFee(order.total, cardFees[type]) : order.total;

  const onPay = async (input: PublicPaymentRequest) => {
    setError(null);
    try {
      // The card token is single use: every submit is a new operation. With
      // a fee, the total shown goes along: the API refuses it if it changed.
      await pay({
        token: order.publicToken,
        input: cardFees ? { ...input, amount } : input,
        idempotencyKey: randomId(),
      }).unwrap();
      if (input.payer.email) dispatch(rememberEmail(input.payer.email));
    } catch (err) {
      setError(errorText(err));
      // The store changed its card fee meanwhile, or the card was charged as
      // another type (and given back): read the order again, so the total
      // shown is current and the next try sends it.
      if (errorCode(err) === "E_AMOUNT_CHANGED" || errorCode(err) === "E_CARD_TYPE_CHANGED") {
        dispatch(publicApi.util.invalidateTags([{ type: "PublicOrder", id: order.publicToken }]));
      }
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {payment?.status === "rejected" && (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertDescription>{cardRejection(payment.statusDetail)}</AlertDescription>
        </Alert>
      )}
      {payment?.status === "pending" && payment.challenge && (
        <CardChallenge order={order} challenge={payment.challenge} />
      )}
      {payment?.status === "pending" && !payment.challenge && (
        <p className="flex items-center gap-2 text-sm font-medium" aria-live="polite">
          <Spinner className="text-primary" aria-hidden /> Pagamento em análise. Avisamos aqui assim que
          for aprovado.
        </p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {payment?.status !== "pending" && cardFees && (
        <div className="flex flex-col gap-3">
          <RadioGroup
            aria-label="Tipo de cartão"
            value={type}
            onValueChange={(value) => setType(value as CardType)}
            className="grid-cols-2"
          >
            {CARD_TYPES.map((option) => {
              const optionFee = cardFee(order.total, cardFees[option.value]);
              return (
                <Radio.Root
                  key={option.value}
                  value={option.value}
                  className="flex flex-col items-center gap-0.5 rounded-xl border p-2.5 text-sm font-medium transition-colors outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 data-checked:border-primary data-checked:bg-primary/5 data-checked:text-primary"
                >
                  {option.label}
                  <span className="text-xs font-normal text-muted-foreground tabular-nums">
                    {optionFee > 0 ? `+ ${formatCurrencyBRL(optionFee)} de taxa` : "sem taxa"}
                  </span>
                </Radio.Root>
              );
            })}
          </RadioGroup>
          <dl className="flex flex-col gap-1 rounded-xl bg-muted/50 p-3 text-sm tabular-nums">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Pedido</dt>
              <dd>{formatCurrencyBRL(order.total)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">
                Taxa do cartão ({type === "credit" ? "crédito" : "débito"}, {formatPercent(cardFees[type])})
              </dt>
              <dd>{formatCurrencyBRL(fee)}</dd>
            </div>
            <div className="flex justify-between gap-3 font-semibold">
              <dt>Total no cartão</dt>
              <dd aria-live="polite">{formatCurrencyBRL(amount)}</dd>
            </div>
          </dl>
          <p className="text-xs text-muted-foreground">No Pix não há taxa.</p>
        </div>
      )}
      {payment?.status !== "pending" && (
        <CardPaymentForm
          // Another type rebuilds the Brick: a new instance shows its loading state again.
          key={type}
          publicKey={publicKey}
          amount={amount}
          maxInstallments={maxInstallments}
          paymentType={cardFees ? CARD_TYPES.find((option) => option.value === type)!.paymentType : undefined}
          email={savedEmail}
          onPay={onPay}
        />
      )}
    </div>
  );
}
