"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowLeft,
  CreditCard,
  Minus,
  Plus,
  ShoppingBag,
  Store as StoreIcon,
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
import { addRecentOrder, rememberCustomer } from "@/redux/slices/customer";
import { usePlaceOrderMutation } from "@/redux/features/public/publicApi";
import { isConnectionError } from "@/utils/get-error-message";
import { releaseIdempotencyKey, stableIdempotencyKey } from "@/lib/idempotency";
import { useRehydrated } from "@/hooks/use-rehydrated";
import { formatCurrencyBRL, formatPhoneBR } from "@/utils/string";
import { getErrorMessage } from "@/utils/get-error-message";
import { cn } from "@/lib/utils";

type Store = PublicMenu["store"];

/** Floating "view bag" bar + the bag/checkout modal. */
export function Cart({ store }: { store: Store }) {
  const rehydrated = useRehydrated();
  const cart = useAppSelector((state) => state.cart);
  const [open, setOpen] = useState(false);

  const lines = cart.storeSlug === store.slug ? cart.lines : [];
  const count = lines.reduce((sum, line) => sum + line.quantity, 0);
  const total = lines.reduce((sum, line) => sum + lineTotal(line), 0);

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

      <ResponsiveModal open={open} onOpenChange={setOpen} title="Sua sacola" className="sm:max-w-md">
        <CartContent store={store} lines={lines} total={total} onDone={() => setOpen(false)} />
      </ResponsiveModal>
    </>
  );
}

function CartContent({
  store,
  lines,
  total,
  onDone,
}: {
  store: Store;
  lines: CartLine[];
  total: number;
  onDone: () => void;
}) {
  const [step, setStep] = useState<"bag" | "checkout">("bag");

  if (lines.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-4 py-12 text-center text-muted-foreground">
        <ShoppingBag className="size-10" />
        <p className="font-medium text-foreground">Sua sacola está vazia</p>
        <p className="text-sm">Escolha algo gostoso no cardápio.</p>
      </div>
    );
  }

  return step === "bag" ? (
    <BagStep lines={lines} total={total} onNext={() => setStep("checkout")} storeOpen={store.isOpen} />
  ) : (
    <CheckoutStep store={store} lines={lines} total={total} onBack={() => setStep("bag")} onDone={onDone} />
  );
}

function BagStep({
  lines,
  total,
  storeOpen,
  onNext,
}: {
  lines: CartLine[];
  total: number;
  storeOpen: boolean;
  onNext: () => void;
}) {
  const dispatch = useAppDispatch();

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
                  onClick={() => dispatch(setQuantity({ key: line.key, quantity: line.quantity + 1 }))}
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
  paymentMethod: z.enum(["counter", "mercado_pago"]),
  notes: z.string().max(500).optional(),
});
type CheckoutValues = z.infer<typeof CheckoutSchema>;

function CheckoutStep({
  store,
  lines,
  total,
  onBack,
  onDone,
}: {
  store: Store;
  lines: CartLine[];
  total: number;
  onBack: () => void;
  onDone: () => void;
}) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const customer = useAppSelector((state) => state.customer);
  const [placeOrder, { isLoading }] = usePlaceOrderMutation();
  const [error, setError] = useState<string | null>(null);

  const methods = [
    store.mercadoPagoEnabled && {
      value: "mercado_pago" as const,
      label: "Pix ou cartão agora",
      hint: "Pague online com Mercado Pago",
      icon: CreditCard,
    },
    store.counterPaymentEnabled && {
      value: "counter" as const,
      label: "Pagar na retirada",
      hint: "Dinheiro, cartão ou Pix no balcão",
      icon: StoreIcon,
    },
  ].filter(Boolean) as { value: CheckoutValues["paymentMethod"]; label: string; hint: string; icon: typeof StoreIcon }[];

  const form = useForm<CheckoutValues>({
    resolver: zodResolver(CheckoutSchema),
    defaultValues: {
      name: customer.name,
      phone: formatPhoneBR(customer.phone),
      paymentMethod: methods[0]?.value ?? "counter",
      notes: "",
    },
  });

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
      }).unwrap();
      releaseIdempotencyKey(keyScope);

      dispatch(rememberCustomer({ name: values.name, phone: values.phone }));
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

      if (order.checkoutUrl) window.location.assign(order.checkoutUrl);
      else router.push(`/pedido/${order.publicToken}`);
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

  return (
    <form onSubmit={form.handleSubmit(submit)} className="flex flex-col">
      <div className="space-y-5 p-4 pt-0">
        <Button type="button" variant="ghost" size="sm" className="-ml-2" onClick={onBack}>
          <ArrowLeft /> Voltar para a sacola
        </Button>

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

        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-semibold">Pagamento · retirada no balcão</legend>
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

      <div className="sticky bottom-0 space-y-3 border-t bg-background/95 p-4 backdrop-blur">
        <div className="flex items-center justify-between font-semibold">
          <span>Total</span>
          <AnimatedPrice value={total} className="text-lg" />
        </div>
        <Button type="submit" size="lg" className="h-11 w-full rounded-full" loading={isLoading} disabled={methods.length === 0}>
          {isLoading ? "Enviando…" : "Fazer pedido"}
        </Button>
      </div>
    </form>
  );
}
