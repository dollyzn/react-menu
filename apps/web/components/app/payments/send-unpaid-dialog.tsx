"use client";

import { useMemo } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Check, Clock, HandCoins, Phone, ReceiptText, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { ResponsiveModal } from "@/components/app/responsive-modal";
import { CustomerAutocomplete } from "@/components/app/customers/customer-autocomplete";
import { formatCurrencyBRL, formatPhoneBR } from "@/utils/string";
import { cn } from "@/lib/utils";

/** When an order sent unpaid is paid: at pickup (the counter receives it), or another day (fiado). */
export type UnpaidChoice = "pickup" | "payLater";
export type UnpaidConfirm = { kind: "pickup" } | { kind: "payLater"; name: string; phone: string };

const BOTH: UnpaidChoice[] = ["pickup", "payLater"];

const CHOICES: Record<UnpaidChoice, { label: string; hint: string; icon: typeof Clock }> = {
  pickup: { label: "Receber na retirada", hint: "O balcão recebe ao entregar", icon: Clock },
  payLater: { label: "Pagar depois (fiado)", hint: "Entrega sem receber; fica em Pagar depois", icon: HandCoins },
};

/** The counter's placeholder name: not someone to charge. */
const usableName = (name: string | null | undefined) => {
  const trimmed = name?.trim() ?? "";
  return trimmed.toLowerCase() === "balcão" ? "" : trimmed;
};
const phoneDigits = (phone: string) => phone.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");

const Schema = z
  .object({
    choice: z.enum(["pickup", "payLater"]).nullable(),
    name: z.string(),
    phone: z.string(),
  })
  .superRefine((value, ctx) => {
    if (value.choice !== "payLater") return;
    if (usableName(value.name).length < 2) {
      ctx.addIssue({ code: "custom", path: ["name"], message: "Informe o nome de quem vai pagar." });
    }
    if (!/^\d{10,11}$/.test(phoneDigits(value.phone))) {
      ctx.addIssue({ code: "custom", path: ["phone"], message: "Informe o celular com DDD." });
    }
  });
type Values = z.infer<typeof Schema>;

/**
 * Sending without receiving now, confirmed like the other payment methods:
 * "Receber na retirada" (the counter receives it on "Entregar") or "Pagar
 * depois (fiado)", which asks who to charge (name and phone) and leaves the
 * order in the managers' "Pagar depois". The name suggests the store's
 * customers like the POS ticket (picking one fills the phone). With one
 * choice (an order already sent), it opens straight on it.
 */
export function SendUnpaidDialog({
  storeId,
  open,
  onClose,
  badge,
  total,
  name,
  phone,
  choices = BOTH,
  verb = "Enviar",
  busy,
  error,
  onConfirm,
}: {
  storeId: string;
  open: boolean;
  onClose: () => void;
  /** The pill over the amount ("Novo pedido · 2 itens", "Pedido #12 · Ana"). */
  badge: string;
  total: number;
  /** Who it is for, as known (the ticket's or the order's). */
  name: string | null;
  phone: string | null;
  choices?: UnpaidChoice[];
  /** "Enviar" (the POS) or "Deixar" (an order already sent). */
  verb?: string;
  busy: boolean;
  error: string | null;
  onConfirm: (confirm: UnpaidConfirm) => void;
}) {
  const defaults = useMemo<Values>(
    () => ({
      choice: choices.length === 1 ? choices[0] : null,
      name: usableName(name),
      phone: phone ? formatPhoneBR(phone) : "",
    }),
    [choices, name, phone]
  );
  // `values` follows what is known while it is closed; typing doesn't reset it.
  const form = useForm<Values>({ resolver: zodResolver(Schema), defaultValues: defaults, values: open ? undefined : defaults });
  const choice = useWatch({ control: form.control, name: "choice" });

  const submit = form.handleSubmit((values) => {
    if (values.choice === "pickup") onConfirm({ kind: "pickup" });
    else if (values.choice === "payLater")
      onConfirm({ kind: "payLater", name: values.name.trim(), phone: phoneDigits(values.phone) });
  });

  const confirmLabel =
    choice === "pickup"
      ? `${verb} · receber na retirada`
      : choice === "payLater"
        ? `${verb} para pagar depois`
        : "Escolha quando o cliente paga";

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(next) => !next && !busy && onClose()}
      // Cleared once closed, never while it animates out.
      onOpenChangeComplete={(next) => !next && form.reset(defaults)}
      title={choices.length === 1 ? "Pagar depois" : "Enviar sem receber agora"}
      description="Escolha quando o cliente paga."
      hideHeader
      className="sm:max-w-md"
    >
      <form className="flex flex-col" onSubmit={(event) => void submit(event)}>
        {/* The amount first, as on the other payment dialogs. */}
        <header className="flex flex-col items-center gap-2 px-4 pt-6 pb-5 text-center">
          <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
            <ReceiptText className="size-3.5 shrink-0" />
            <span className="truncate">{badge}</span>
          </span>
          <p className="text-4xl font-black tracking-tight tabular-nums">{formatCurrencyBRL(total)}</p>
          <p className="text-sm text-muted-foreground">{choice === "payLater" ? "para pagar depois" : "a receber"}</p>
        </header>

        <div className="flex flex-col gap-5 px-4 pb-4">
          {choices.length > 1 && (
            <section className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Quando o cliente paga</h3>
              <Controller
                name="choice"
                control={form.control}
                render={({ field }) => (
                  <div className="grid grid-cols-2 gap-2" role="group" aria-label="Quando o cliente paga">
                    {choices.map((value) => {
                      const { label, hint, icon: Icon } = CHOICES[value];
                      const selected = field.value === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          aria-pressed={selected}
                          disabled={busy}
                          onClick={() => field.onChange(value)}
                          className={cn(
                            "group relative flex flex-col items-start gap-2 rounded-2xl border bg-card p-3 text-left transition-all outline-none",
                            "hover:border-primary/40 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60",
                            selected && "border-primary bg-primary/5 shadow-sm"
                          )}
                        >
                          <span
                            className={cn(
                              "flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground transition-colors",
                              selected && "bg-primary text-primary-foreground"
                            )}
                          >
                            <Icon className="size-5" />
                          </span>
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold">{label}</span>
                            <span className="block text-xs leading-tight text-muted-foreground">{hint}</span>
                          </span>
                          {selected && (
                            <span className="absolute top-2 right-2 flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                              <Check className="size-3" strokeWidth={3} />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              />
            </section>
          )}

          {choice === "payLater" && (
            <FieldGroup className="gap-4">
              <p className="text-sm text-balance text-muted-foreground">
                O pedido vai para a cozinha e é entregue sem receber agora. Ele fica em{" "}
                <span className="font-medium text-foreground">Pagar depois</span> até o cliente pagar.
              </p>
              <Controller
                name="name"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="unpaid-name">Quem vai pagar</FieldLabel>
                    {/* Like the ticket: the store's customers by name or phone; a pick fills the phone. */}
                    <CustomerAutocomplete
                      storeId={storeId}
                      id="unpaid-name"
                      name={field.value}
                      onNameChange={field.onChange}
                      onPick={(customer) => {
                        field.onChange(customer.name);
                        form.setValue("phone", customer.phone, { shouldValidate: form.formState.isSubmitted });
                      }}
                      onUnpick={(customer) => {
                        if (form.getValues("phone") === customer.phone) form.setValue("phone", "");
                      }}
                      onClear={() => {
                        field.onChange("");
                        form.setValue("phone", "");
                      }}
                      placeholder="Nome ou celular do cliente"
                      inputClassName="h-9"
                      invalid={fieldState.invalid}
                      disabled={busy}
                      inline
                    />
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
              <Controller
                name="phone"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="unpaid-phone">Celular com DDD</FieldLabel>
                    <InputGroup>
                      <InputGroupAddon>
                        <Phone />
                      </InputGroupAddon>
                      <InputGroupInput
                        {...field}
                        onChange={(event) => field.onChange(formatPhoneBR(event.target.value))}
                        id="unpaid-phone"
                        type="tel"
                        inputMode="tel"
                        autoComplete="off"
                        disabled={busy}
                        placeholder="(13) 99999-9999"
                        aria-invalid={fieldState.invalid}
                      />
                    </InputGroup>
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
            </FieldGroup>
          )}

          {error && (
            <p role="alert" className="flex items-start gap-2 rounded-2xl bg-destructive/10 p-3 text-sm text-destructive">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" /> {error}
            </p>
          )}
        </div>

        <div className="flex flex-col items-center gap-2 border-t bg-muted/30 p-4">
          <Button type="submit" size="lg" className="h-12 w-full rounded-xl text-base shadow-sm" disabled={!choice} loading={busy}>
            {confirmLabel}
          </Button>
          <Button type="button" variant="ghost" className="w-full" disabled={busy} onClick={onClose}>
            Voltar
          </Button>
        </div>
      </form>
    </ResponsiveModal>
  );
}
