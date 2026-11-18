"use client";

import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Percent } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
import { Switch } from "@/components/ui/switch";
import { cardFee } from "@/lib/card-fee";
import { useUpdatePaymentSettingsMutation } from "@/redux/features/store/storeApi";
import { formatCurrencyBRL } from "@/utils/string";

/** "4,99" or "4.99" → 4.99; NaN when it isn't a number. */
const parsePercent = (value: string) => (value.trim() ? Number(value.trim().replace(",", ".")) : 0);
const percent = z
  .string()
  .refine((value) => /^\d{0,2}([.,]\d{0,2})?$/.test(value.trim()), "Use um número como 4,99.")
  .refine((value) => parsePercent(value) <= 20, "No máximo 20%.");

const Schema = z
  .object({ enabled: z.boolean(), credit: percent, debit: percent })
  .refine((values) => !values.enabled || parsePercent(values.credit) > 0 || parsePercent(values.debit) > 0, {
    path: ["credit"],
    message: "Informe a taxa de pelo menos um tipo de cartão.",
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
          cardCreditFeePercent: parsePercent(data.credit),
          cardDebitFeePercent: parsePercent(data.debit),
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
    return Number.isFinite(value) && value > 0
      ? `${formatCurrencyBRL(EXAMPLE + cardFee(EXAMPLE, value))} (+${formatCurrencyBRL(cardFee(EXAMPLE, value))})`
      : formatCurrencyBRL(EXAMPLE);
  };

  return (
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
      <form noValidate onSubmit={form.handleSubmit(submit)} className="contents">
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
        <CardFooter className="justify-end gap-2 border-t">
          <Button
            type="button"
            variant="outline"
            disabled={busy || !form.formState.isDirty}
            onClick={() => form.reset(toForm(store))}
          >
            Desfazer alterações
          </Button>
          <Button type="submit" loading={busy} disabled={!form.formState.isDirty}>
            Salvar
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
