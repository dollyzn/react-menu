"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Settings2 } from "lucide-react";
import { NumberStepper } from "@/components/app/number-stepper";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldSeparator } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { getErrorMessage } from "@/utils/get-error-message";
import { UnsavedChangesBar } from "./unsaved-changes-bar";
import { useSaveStore } from "./use-save-store";

const Schema = z.object({
  pickupEtaMinutes: z.number({ message: "Informe os minutos." }).int().min(1, "Pelo menos 1 minuto.").max(240, "No máximo 240 minutos."),
  counterPaymentEnabled: z.boolean(),
  inventoryEnabled: z.boolean(),
  kitchenBatchLookahead: z.number().int().min(0).max(5),
});
type Values = z.infer<typeof Schema>;

const LOOKAHEAD_ITEMS = [
  { value: "0", label: "Desligado: ordem de chegada" },
  ...[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `Até ${n} pedido${n > 1 ? "s" : ""} à frente` })),
];

const toForm = (store: Store): Values => ({
  pickupEtaMinutes: store.pickupEtaMinutes ?? 20,
  counterPaymentEnabled: store.counterPaymentEnabled ?? true,
  inventoryEnabled: store.inventoryEnabled ?? false,
  kitchenBatchLookahead: store.kitchenBatchLookahead ?? 3,
});

/** How orders flow: pickup time, paying at the counter, stock and the kitchen's batching. */
export function StoreOperationCard({ store }: { store: Store }) {
  const [save, { isLoading }] = useSaveStore();
  const form = useForm<Values>({ resolver: zodResolver(Schema), defaultValues: toForm(store) });
  const busy = form.formState.isSubmitting || isLoading;

  const submit = async (values: Values) => {
    try {
      const saved = await save(store.id, values);
      form.reset(toForm(saved));
      toast.success("Operação da loja salva");
    } catch (error) {
      form.setError("root", {
        message: getErrorMessage(error as { data?: { error?: string } }, "Não foi possível salvar. Tente de novo."),
      });
    }
  };

  return (
    <form noValidate onSubmit={form.handleSubmit(submit)} className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="size-4 text-primary" /> Pedidos e cozinha
          </CardTitle>
          <CardDescription>Como os pedidos chegam, são pagos e preparados.</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Controller
              name="pickupEtaMinutes"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field orientation="responsive" data-invalid={fieldState.invalid}>
                  <FieldContent>
                    <FieldLabel htmlFor="store-eta">Tempo de retirada</FieldLabel>
                    <FieldDescription>
                      Minutos que o cliente vê como previsão depois de pedir (em média, do pedido à retirada).
                    </FieldDescription>
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </FieldContent>
                  <NumberStepper
                    id="store-eta"
                    label="minutos de retirada"
                    min={1}
                    max={240}
                    value={field.value}
                    onChange={field.onChange}
                    disabled={busy}
                    invalid={fieldState.invalid}
                    className="max-w-44 shrink-0"
                  />
                </Field>
              )}
            />
            <FieldSeparator />
            <Controller
              name="counterPaymentEnabled"
              control={form.control}
              render={({ field }) => (
                <Field orientation="horizontal">
                  <FieldContent>
                    <FieldLabel htmlFor="store-counter-payment">Pagar na retirada</FieldLabel>
                    <FieldDescription>Clientes podem pedir pelo cardápio e pagar no balcão.</FieldDescription>
                  </FieldContent>
                  <Switch id="store-counter-payment" checked={field.value} onCheckedChange={field.onChange} disabled={busy} />
                </Field>
              )}
            />
            <Controller
              name="inventoryEnabled"
              control={form.control}
              render={({ field }) => (
                <Field orientation="horizontal">
                  <FieldContent>
                    <FieldLabel htmlFor="store-inventory">Controlar estoque</FieldLabel>
                    <FieldDescription>Itens sem ingredientes suficientes ficam indisponíveis no cardápio e no PDV.</FieldDescription>
                  </FieldContent>
                  <Switch id="store-inventory" checked={field.value} onCheckedChange={field.onChange} disabled={busy} />
                </Field>
              )}
            />
            <FieldSeparator />
            <Controller
              name="kitchenBatchLookahead"
              control={form.control}
              render={({ field }) => (
                <Field orientation="responsive">
                  <FieldContent>
                    <FieldLabel htmlFor="store-lookahead">Agrupar pastéis iguais na cozinha</FieldLabel>
                    <FieldDescription>
                      A cozinha faz de uma vez os pastéis iguais de pedidos próximos. Quanto mais pedidos à frente, mais
                      rápido sai o lote, mas um pedido que chegou antes pode esperar.
                    </FieldDescription>
                  </FieldContent>
                  <Select
                    items={LOOKAHEAD_ITEMS}
                    value={String(field.value)}
                    onValueChange={(value) => field.onChange(Number(value))}
                    disabled={busy}
                  >
                    <SelectTrigger id="store-lookahead" className="w-full sm:w-60 sm:shrink-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LOOKAHEAD_ITEMS.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
            />
            {form.formState.errors.root?.message && (
              <p role="alert" className="text-sm text-destructive">
                {form.formState.errors.root.message}
              </p>
            )}
          </FieldGroup>
        </CardContent>
      </Card>
      <UnsavedChangesBar dirty={form.formState.isDirty} busy={busy} onReset={() => form.reset(toForm(store))} />
    </form>
  );
}
