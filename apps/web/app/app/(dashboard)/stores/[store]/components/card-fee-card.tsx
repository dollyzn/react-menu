"use client";

import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Percent } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
import { Switch } from "@/components/ui/switch";
import { cardFee, withCardFee } from "@/lib/card-fee";
import { useUpdatePaymentSettingsMutation } from "@/redux/features/store/storeApi";
import { formatCurrencyBRL } from "@/utils/string";
import { UnsavedChangesBar } from "./unsaved-changes-bar";
import { useFollowSaved } from "./use-follow-saved";

/** "4,99" or "4.99" → 4.99; NaN when it isn't a number. */
const parsePercent = (value: string) => (value.trim() ? Number(value.trim().replace(",", ".")) : 0);
/** Why a percent field is refused, or null when it is fine. */
const percentError = (value: string) =>
  !/^(\d{1,2}([.,]\d{1,2})?)?$/.test(value.trim())
    ? "Use um número como 4,99."
    : parsePercent(value) > 20
      ? "No máximo 20%."
      : null;

// The percents are checked only while the fee is on: the fields are disabled
// when it is off, and an error there could not be fixed.
const Schema = z
  .object({ enabled: z.boolean(), credit: z.string(), debit: z.string() })
  .superRefine((values, ctx) => {
    if (!values.enabled) return;
    for (const name of ["credit", "debit"] as const) {
      const message = percentError(values[name]);
      if (message) ctx.addIssue({ code: "custom", path: [name], message });
    }
    if (!(parsePercent(values.credit) > 0) && !(parsePercent(values.debit) > 0)) {
      ctx.addIssue({ code: "custom", path: ["credit"], message: "Informe a taxa de pelo menos um tipo de cartão." });
    }
  });
type Values = z.infer<typeof Schema>;

const asText = (value: number) => (value ? String(value).replace(".", ",") : "");
const toForm = (store: Store): Values => ({
  enabled: store.cardFeeEnabled,
  credit: asText(store.cardCreditFeePercent),
  debit: asText(store.cardDebitFeePercent),
});

/** An order of this value shows the example. */
const EXAMPLE = 50;

/**
 * The card fee passed on to the customer in the online checkout: a percent
 * for credit and one for debit. The customer sees it before paying, and the
 * API charges it on top of the order (Pix never pays it).
 */
export function CardFeeCard({ store }: { store: Store }) {
  const [save, { isLoading }] = useUpdatePaymentSettingsMutation();
  const form = useForm<Values>({ resolver: zodResolver(Schema), defaultValues: toForm(store) });
  useFollowSaved(form, () => toForm(store), store.updatedAt);
  const values = useWatch({ control: form.control }) as Values;
  const busy = form.formState.isSubmitting || isLoading;
  const cardOn = store.mercadoPagoEnabled && Boolean(store.mercadoPagoPublicKey);
  const active = store.cardFeeEnabled && (store.cardCreditFeePercent > 0 || store.cardDebitFeePercent > 0);

  const submit = async (data: Values) => {
    try {
      const saved = await save({
        id: store.id,
        data: {
          cardFeeEnabled: data.enabled,
          // Turned off with a half-typed percent: the saved one stays.
          cardCreditFeePercent: percentError(data.credit) ? store.cardCreditFeePercent : parsePercent(data.credit),
          cardDebitFeePercent: percentError(data.debit) ? store.cardDebitFeePercent : parsePercent(data.debit),
        },
      }).unwrap();
      form.reset(toForm({ ...store, ...saved }));
      toast.success(data.enabled ? "Taxa do cartão salva" : "Taxa do cartão desligada");
    } catch {
      // baseApi shows the API's answer.
    }
  };

  const example = (text: string) => {
    const value = parsePercent(text);
    if (!(Number.isFinite(value) && value > 0)) return formatCurrencyBRL(EXAMPLE);
    return `${formatCurrencyBRL(withCardFee(EXAMPLE, value))} (+${formatCurrencyBRL(cardFee(EXAMPLE, value))})`;
  };

  return (
    <form noValidate onSubmit={form.handleSubmit(submit)} className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            <Percent className="size-4 text-primary" /> Taxa do cartão
            <Badge variant={active ? "default" : "secondary"}>{active ? "Repassada ao cliente" : "Paga pela loja"}</Badge>
          </CardTitle>
          <CardDescription>
            No pagamento online com cartão, o cliente pode pagar a taxa por cima do pedido. Ele vê o valor antes de
            pagar; o Pix continua sem taxa.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!cardOn && (
            <p className="mb-4 rounded-xl bg-muted/60 p-3 text-sm text-muted-foreground">
              O cartão no cardápio precisa da Public Key em “Pagamentos online”. Você já pode deixar a taxa pronta.
            </p>
          )}
          <FieldGroup>
            <Controller
              name="enabled"
              control={form.control}
              render={({ field }) => (
                <Field orientation="horizontal">
                  <FieldContent>
                    <FieldLabel htmlFor="card-fee-enabled">Repassar a taxa ao cliente</FieldLabel>
                    <FieldDescription>Desligada, a loja paga a taxa como hoje. As porcentagens ficam salvas.</FieldDescription>
                  </FieldContent>
                  <Switch id="card-fee-enabled" checked={field.value} onCheckedChange={field.onChange} disabled={busy} />
                </Field>
              )}
            />
            <div className="grid gap-6 sm:grid-cols-2">
              {(
                [
                  { name: "credit", label: "Crédito", hint: "À vista ou parcelado (juros do parcelamento à parte)." },
                  { name: "debit", label: "Débito", hint: "Cobrada no débito." },
                ] as const
              ).map(({ name, label, hint }) => (
                <Controller
                  key={name}
                  name={name}
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid} data-disabled={!values.enabled || undefined}>
                      <FieldLabel htmlFor={`card-fee-${name}`}>Taxa no {label.toLowerCase()}</FieldLabel>
                      <InputGroup>
                        <InputGroupInput
                          {...field}
                          id={`card-fee-${name}`}
                          inputMode="decimal"
                          placeholder="0"
                          disabled={busy || !values.enabled}
                          aria-invalid={fieldState.invalid}
                        />
                        <InputGroupAddon align="inline-end">
                          <InputGroupText>%</InputGroupText>
                        </InputGroupAddon>
                      </InputGroup>
                      {fieldState.invalid ? (
                        <FieldError errors={[fieldState.error]} />
                      ) : (
                        <FieldDescription>
                          {hint} Pedido de {formatCurrencyBRL(EXAMPLE)}: {example(field.value)}.
                        </FieldDescription>
                      )}
                    </Field>
                  )}
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Use as taxas do seu plano no Mercado Pago (Seu negócio › Custos). O cliente vê a taxa e o total antes de
              pagar.
            </p>
          </FieldGroup>
        </CardContent>
      </Card>
      <UnsavedChangesBar dirty={form.formState.isDirty} busy={busy} onReset={() => form.reset(toForm(store))} />
    </form>
  );
}
