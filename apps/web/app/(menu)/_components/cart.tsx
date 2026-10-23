"use client";

import { useState } from "react";
import { toast } from "sonner";
import Image from "@/components/app/image";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowLeft,
  MapPin,
  User,
  Minus,
  Plus,
  ShoppingBag,
  Trash2,
} from "lucide-react";
import type { PublicMenu } from "@react-menu/contracts";
import { ResponsiveModal } from "@/components/app/responsive-modal";
import { AnimatedPrice } from "@/components/app/animated-price";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { clearCart, lineTotal, setQuantity, type CartLine } from "@/redux/slices/cart";
import { addRecentOrder, linkStore, rememberCustomer } from "@/redux/slices/customer";
import { usePlaceOrderMutation } from "@/redux/features/public/publicApi";
import { isConnectionError } from "@/utils/get-error-message";
import { releaseIdempotencyKey, stableIdempotencyKey } from "@/lib/idempotency";
import { useRehydrated } from "@/hooks/use-rehydrated";
import { formatCurrencyBRL, formatPhoneBR } from "@/utils/string";
import { getErrorMessage } from "@/utils/get-error-message";
import { cn } from "@/lib/utils";
import { CHECKOUT_METHODS } from "../_lib/payment-methods";

type Store = PublicMenu["store"];

/** Floating "view bag" bar + the bag/checkout modal. */
/** Units the stock still makes per item id (null = no limit), from the menu. */
export type StockMap = Record<string, number | null>;

export function Cart({ store, stock }: { store: Store; stock: StockMap }) {
  const rehydrated = useRehydrated();
  const cart = useAppSelector((state) => state.cart);
  const [open, setOpen] = useState(false);

  const lines = cart.storeSlug === store.slug ? cart.lines : [];
  const count = lines.reduce((sum, line) => sum + line.quantity, 0);
  const total = lines.reduce((sum, line) => sum + lineTotal(line), 0);

  // "Pedir de novo" lands here with ?sacola=1: the bag opens once restored.
  const [autoOpenHandled, setAutoOpenHandled] = useState(false);
  const autoOpen =
    rehydrated &&
    !autoOpenHandled &&
    count > 0 &&
    new URLSearchParams(window.location.search).get("sacola") === "1";
  const changeOpen = (next: boolean) => {
    setOpen(next);
    if (!next && autoOpen) {
      setAutoOpenHandled(true);
      const url = new URL(window.location.href);
      url.searchParams.delete("sacola");
      window.history.replaceState(window.history.state, "", url);
    }
  };

  return (
    <>
      <AnimatePresence>
        {rehydrated && count > 0 && (
          <motion.div
            initial={{ y: 96, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 96, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            className="fixed inset-x-0 bottom-0 z-40 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
          >
            <Button
              size="lg"
              onClick={() => setOpen(true)}
              className="mx-auto flex h-14 w-full max-w-md justify-between rounded-2xl px-4 text-base shadow-xl shadow-primary/25"
            >
              <span className="flex items-center gap-3">
                <span className="relative">
                  <ShoppingBag className="size-5" />
                  <motion.span
                    key={count}
                    initial={{ scale: 0.4 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-2 -right-2.5 flex size-5 items-center justify-center rounded-full bg-background text-xs font-bold text-foreground"
                  >
                    {count}
                  </motion.span>
                </span>
                Ver sacola
              </span>
              <AnimatedPrice value={total} className="font-semibold" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <ResponsiveModal open={open || autoOpen} onOpenChange={changeOpen} title="Sua sacola" className="sm:max-w-md">
        <CartContent store={store} stock={stock} lines={lines} total={total} onDone={() => changeOpen(false)} />
      </ResponsiveModal>
    </>
  );
}

type Step = "bag" | "details" | "review";
const STEPS: { id: Step; label: string }[] = [
  { id: "bag", label: "Sacola" },
  { id: "details", label: "Seus dados" },
  { id: "review", label: "Pagamento" },
];

function CartContent({
  store,
  stock,
  lines,
  total,
  onDone,
}: {
  store: Store;
  stock: StockMap;
  lines: CartLine[];
  total: number;
  onDone: () => void;
}) {
  const remembered = useAppSelector((state) => Boolean(state.customer.name && state.customer.phone));
  const [step, setStep] = useState<Step>("bag");

  if (lines.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-4 py-12 text-center text-muted-foreground">
        <ShoppingBag className="size-10" />
        <p className="font-medium text-foreground">Sua sacola está vazia</p>
        <p className="text-sm">Escolha algo gostoso no cardápio.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <Stepper current={step} onBack={step === "bag" ? undefined : () => setStep(step === "review" && !remembered ? "details" : "bag")} />
      {step === "bag" ? (
        // Returning customers skip straight to the review.
        <BagStep lines={lines} stock={stock} total={total} onNext={() => setStep(remembered ? "review" : "details")} storeOpen={store.isOpen} />
      ) : (
        <CheckoutFlow
          store={store}
          lines={lines}
          total={total}
          step={step}
          onStep={setStep}
          onDone={onDone}
        />
      )}
    </div>
  );
}

/** Progress across the three steps; "Voltar" goes one step back. */
function Stepper({ current, onBack }: { current: Step; onBack?: () => void }) {
  const index = STEPS.findIndex((step) => step.id === current);
  return (
    <div className="space-y-2 px-4 pt-1 pb-3">
      <div className="flex items-center gap-2">
        {onBack ? (
          <Button type="button" variant="ghost" size="icon-sm" className="-ml-2 rounded-full" aria-label="Voltar" onClick={onBack}>
            <ArrowLeft />
          </Button>
        ) : (
          <span className="size-2" />
        )}
        <ol className="flex flex-1 items-center gap-1 text-xs font-medium" aria-label="Etapas do pedido">
          {STEPS.map((step, i) => (
            <li
              key={step.id}
              aria-current={i === index ? "step" : undefined}
              className={cn("flex flex-1 flex-col gap-1.5", i <= index ? "text-foreground" : "text-muted-foreground")}
            >
              <span className={cn("h-1 rounded-full transition-colors", i <= index ? "bg-primary" : "bg-muted")} />
              {step.label}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function BagStep({
  lines,
  stock,
  total,
  storeOpen,
  onNext,
}: {
  lines: CartLine[];
  stock: StockMap;
  total: number;
  storeOpen: boolean;
  onNext: () => void;
}) {
  const dispatch = useAppDispatch();
  const inBag = (itemId: string) =>
    lines.filter((line) => line.itemId === itemId).reduce((sum, line) => sum + line.quantity, 0);
  const left = (itemId: string) => stock[itemId] ?? null;

  const increase = (line: CartLine) => {
    const units = left(line.itemId);
    if (units !== null && inBag(line.itemId) >= units) {
      toast.info(`Só temos ${units} ${line.name} agora.`, { id: "stock-limit" });
      return;
    }
    dispatch(setQuantity({ key: line.key, quantity: line.quantity + 1 }));
  };

  return (
    <div className="flex flex-col">
      <ul className="divide-y px-4">
        <AnimatePresence initial={false}>
          {lines.map((line) => (
            <motion.li
              key={line.key}
              layout
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="flex gap-3 py-3"
            >
              <div className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-muted">
                {line.photoUrl && <Image src={line.photoUrl} alt="" fill sizes="56px" className="object-cover" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium leading-snug">{line.name}</p>
                {line.addons.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    + {line.addons.map((addon) => addon.name).join(", ")}
                  </p>
                )}
                {line.notes && <p className="text-xs text-muted-foreground italic">“{line.notes}”</p>}
                <p className="mt-1 text-sm font-semibold">{formatCurrencyBRL(lineTotal(line))}</p>
                {left(line.itemId) !== null && inBag(line.itemId) > left(line.itemId)! && (
                  <p role="alert" className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-400">
                    {left(line.itemId) === 0
                      ? "Acabou agora: remova para continuar."
                      : `Só temos ${left(line.itemId)} agora: diminua para continuar.`}
                  </p>
                )}
              </div>
              <div className="flex items-center self-center rounded-full border">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="rounded-full"
                  aria-label={line.quantity === 1 ? `Remover ${line.name}` : `Diminuir ${line.name}`}
                  onClick={() => dispatch(setQuantity({ key: line.key, quantity: line.quantity - 1 }))}
                >
                  {line.quantity === 1 ? <Trash2 className="text-destructive" /> : <Minus />}
                </Button>
                <span className="w-6 text-center text-sm font-semibold tabular-nums">{line.quantity}</span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="rounded-full"
                  aria-label={`Aumentar ${line.name}`}
                  onClick={() => increase(line)}
                >
                  <Plus />
                </Button>
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      <div className="sticky bottom-0 space-y-3 border-t bg-background/95 p-4 backdrop-blur">
        <div className="flex items-center justify-between font-semibold">
          <span>Total</span>
          <AnimatedPrice value={total} className="text-lg" />
        </div>
        <Button size="lg" className="h-11 w-full rounded-full" disabled={!storeOpen} onClick={onNext}>
          {storeOpen ? "Continuar" : "A loja está fechada agora"}
        </Button>
      </div>
    </div>
  );
}

const CheckoutSchema = z.object({
  name: z.string().trim().min(2, "Como podemos te chamar?").max(80),
  phone: z
    .string()
    .refine((value) => [10, 11].includes(value.replace(/\D/g, "").length), "Informe DDD + número"),
  paymentMethod: z.enum(["pix", "card", "counter"]),
  notes: z.string().max(500).optional(),
});
type CheckoutValues = z.infer<typeof CheckoutSchema>;

/** Steps 2 and 3 share one form, so going back keeps what was typed. */
function CheckoutFlow({
  store,
  lines,
  total,
  step,
  onStep,
  onDone,
}: {
  store: Store;
  lines: CartLine[];
  total: number;
  step: "details" | "review";
  onStep: (step: Step) => void;
  onDone: () => void;
}) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const customer = useAppSelector((state) => state.customer);
  const [placeOrder, { isLoading }] = usePlaceOrderMutation();
  const [error, setError] = useState<string | null>(null);

  // The API lists what this store accepts; online methods are paid on the
  // order page right after (no redirect).
  const methods = store.paymentMethods.map((value) => ({ value, ...CHECKOUT_METHODS[value] }));

  const form = useForm<CheckoutValues>({
    resolver: zodResolver(CheckoutSchema),
    defaultValues: {
      name: customer.name,
      phone: formatPhoneBR(customer.phone),
      paymentMethod: methods[0]?.value ?? "counter",
      notes: "",
    },
  });

  const continueToReview = async () => {
    if (await form.trigger(["name", "phone"])) onStep("review");
  };

  const submit = async (values: CheckoutValues) => {
    setError(null);
    const input = {
      customer: { name: values.name, phone: values.phone },
      paymentMethod: values.paymentMethod,
      notes: values.notes || undefined,
      lines: lines.map((line) => ({
        itemId: line.itemId,
        quantity: line.quantity,
        addonIds: line.addons.map((addon) => addon.id),
        notes: line.notes || undefined,
      })),
    };
    // Same order, same key: tapping again after a dropped connection (or
    // reopening the app) returns the order that may already exist.
    const keyScope = `checkout:${store.slug}`;
    try {
      const order = await placeOrder({
        slug: store.slug,
        input,
        idempotencyKey: stableIdempotencyKey(keyScope, input),
        customerToken: customer.tokens?.[store.slug],
      }).unwrap();
      releaseIdempotencyKey(keyScope);

      dispatch(rememberCustomer({ name: values.name, phone: values.phone }));
      if (order.customerToken) dispatch(linkStore({ storeSlug: store.slug, token: order.customerToken }));
      dispatch(
        addRecentOrder({
          publicToken: order.publicToken,
          storeSlug: store.slug,
          storeName: store.name,
          number: order.number,
          total: order.total,
          createdAt: order.createdAt,
        })
      );
      dispatch(clearCart());
      onDone();

      router.push(`/pedido/${order.publicToken}`);
    } catch (err) {
      setError(
        isConnectionError(err)
          ? "A conexão caiu antes da confirmação. Toque em enviar de novo: se o pedido já chegou, ele não será duplicado."
          : getErrorMessage(err as { data?: { error?: string } }, "Não foi possível enviar o pedido.")
      );
      // Prices or availability may have changed: refresh the menu behind the modal.
      router.refresh();
    }
  };

  const [name, phone] = useWatch({ control: form.control, name: ["name", "phone"] });

  return (
    <form onSubmit={form.handleSubmit(submit)} className="flex flex-col">
      {step === "details" ? (
        <div className="space-y-4 p-4 pt-0">
          <div>
            <h3 className="font-semibold">Quem vai retirar?</h3>
            <p className="text-sm text-muted-foreground">Chamamos pelo nome no balcão. O celular é só para o pedido.</p>
          </div>
          <FieldGroup>
            <Controller
              name="name"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="checkout-name">Seu nome</FieldLabel>
                  <Input {...field} id="checkout-name" autoComplete="name" placeholder="Ex.: Ana" aria-invalid={fieldState.invalid} />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            <Controller
              name="phone"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="checkout-phone">Celular (WhatsApp)</FieldLabel>
                  <Input
                    {...field}
                    id="checkout-phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel-national"
                    placeholder="(11) 98765-4321"
                    aria-invalid={fieldState.invalid}
                    onChange={(event) => field.onChange(formatPhoneBR(event.target.value))}
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
          </FieldGroup>
        </div>
      ) : (
        <div className="space-y-5 p-4 pt-0">
          <div className="flex items-center gap-3 rounded-xl border p-3">
            <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
              <User className="size-4" />
            </span>
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-medium">{name}</p>
              <p className="text-muted-foreground">{phone}</p>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => onStep("details")}>
              Alterar
            </Button>
          </div>

          <section aria-labelledby="checkout-summary">
            <h3 id="checkout-summary" className="mb-2 text-sm font-semibold">
              Seu pedido
            </h3>
            <ul className="space-y-1.5 rounded-xl bg-muted/40 p-3 text-sm">
              {lines.map((line) => (
                <li key={line.key} className="flex justify-between gap-3">
                  <span className="min-w-0">
                    <span className="font-medium tabular-nums">{line.quantity}×</span> {line.name}
                    {line.addons.length > 0 && (
                      <span className="block truncate text-xs text-muted-foreground">
                        + {line.addons.map((addon) => addon.name).join(", ")}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 tabular-nums">{formatCurrencyBRL(lineTotal(line))}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
              <MapPin className="mt-0.5 size-3.5 shrink-0" />
              Retirada no balcão{store.address ? ` · ${store.address}` : ""} · fica pronto em cerca de{" "}
              {store.pickupEtaMinutes} min
            </p>
          </section>

          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-semibold">Como você prefere pagar?</legend>
            <Controller
              name="paymentMethod"
              control={form.control}
              render={({ field }) => (
                <div className="grid gap-2" role="radiogroup">
                  {methods.map((method) => (
                    <label
                      key={method.value}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                        field.value === method.value ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                      )}
                    >
                      <input
                        type="radio"
                        className="sr-only"
                        name={field.name}
                        value={method.value}
                        checked={field.value === method.value}
                        onChange={() => field.onChange(method.value)}
                      />
                      <method.icon className="size-5 text-primary" />
                      <span className="flex-1">
                        <span className="block text-sm font-medium">{method.label}</span>
                        <span className="block text-xs text-muted-foreground">{method.hint}</span>
                      </span>
                      <span
                        aria-hidden
                        className={cn(
                          "size-4 rounded-full border-2",
                          field.value === method.value ? "border-primary bg-primary ring-2 ring-background ring-inset" : "border-muted-foreground/40"
                        )}
                      />
                    </label>
                  ))}
                </div>
              )}
            />
          </fieldset>

          <Controller
            name="notes"
            control={form.control}
            render={({ field }) => (
              <Field>
                <FieldLabel htmlFor="checkout-notes">Observação do pedido (opcional)</FieldLabel>
                <Textarea {...field} id="checkout-notes" rows={2} maxLength={500} placeholder="Ex.: vou chegar às 19h30" />
              </Field>
            )}
          />

          {error && (
            <Alert variant="destructive">
              <AlertTitle>Pedido não enviado</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
      )}

      <div className="sticky bottom-0 space-y-3 border-t bg-background/95 p-4 backdrop-blur">
        {/* Distinct keys: reusing one <button> and flipping its type to "submit"
            mid-click would submit the order straight from the details step. */}
        {step === "details" ? (
          <Button
            key="continue"
            type="button"
            size="lg"
            className="h-11 w-full rounded-full"
            onClick={() => void continueToReview()}
          >
            Continuar
          </Button>
        ) : (
          <Button
            key="submit"
            type="submit"
            size="lg"
            className="h-12 w-full justify-between rounded-full px-5"
            loading={isLoading}
            disabled={methods.length === 0}
          >
            {isLoading ? "Enviando…" : "Fazer pedido"}
            <AnimatedPrice value={total} className="font-semibold" />
          </Button>
        )}
      </div>
    </form>
  );
}
