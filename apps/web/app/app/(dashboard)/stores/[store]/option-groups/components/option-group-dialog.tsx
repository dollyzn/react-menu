"use client";

import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Undo2 } from "lucide-react";
import type { OptionGroup } from "@react-menu/contracts";
import MultiCombobox from "@/components/app/multi-combobox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import MoneyInput from "@/components/ui/money-input";
import { NumberStepper } from "@/components/app/number-stepper";
import { useGetAddonsByStoreIdQuery } from "@/redux/features/addon/addonApi";
import { storeListPrefetchArg } from "@/redux/api/listQueryParams";
import {
  useCreateOptionGroupMutation,
  useUpdateOptionGroupMutation,
} from "@/redux/features/option-group/optionGroupApi";
import { formatCurrencyBRL } from "@/utils/string";
import { getErrorMessage } from "@/utils/get-error-message";
import { pickPricesLabel } from "@/lib/choice-pricing";

const Schema = z
  .object({
    name: z.string().trim().min(1, "Dê um nome ao grupo, ex.: Escolha o queijo.").max(120),
    minChoices: z.number({ message: "Informe um número." }).int().min(0, "No mínimo 0.").max(20),
    maxChoices: z.number({ message: "Informe um número." }).int().min(1, "Pelo menos 1.").max(20),
    /** Price by pick order (one per pick up to the maximum); null = each option's price. */
    pickPrices: z.array(z.number().min(0)).nullable(),
    /** In display order; price null = the add-on's own price. */
    options: z
      .array(z.object({ addonId: z.string(), price: z.number().min(0).nullable() }))
      .min(1, "Escolha as opções do grupo."),
  })
  .superRefine((values, ctx) => {
    if (values.minChoices > values.maxChoices) {
      ctx.addIssue({ code: "custom", path: ["minChoices"], message: "O mínimo não pode passar do máximo." });
    }
    const count = values.options.length;
    if (count > 0 && values.maxChoices > count) {
      ctx.addIssue({
        code: "custom",
        path: ["maxChoices"],
        message: `O grupo tem ${count} ${count === 1 ? "opção" : "opções"}.`,
      });
    }
  });

type Values = z.infer<typeof Schema>;

/** Rule of a group in words: "Obrigatório · escolha 1", "Opcional · até 2". */
export function groupRule(group: Pick<OptionGroup, "minChoices" | "maxChoices">) {
  if (group.minChoices === 0) return `Opcional · até ${group.maxChoices}`;
  if (group.minChoices === group.maxChoices) return `Obrigatório · escolha ${group.minChoices}`;
  return `Obrigatório · de ${group.minChoices} a ${group.maxChoices}`;
}

/** One price per pick up to `max`: missing ones repeat the last (or 0). */
const tiers = (prices: number[], max: number) =>
  Array.from({ length: max }, (_, index) => prices[index] ?? prices.at(-1) ?? 0);

const ordinal = (index: number) => `${index + 1}ª escolha`;

/** Create or edit a choice group; its options are the store's add-ons. */
export function OptionGroupDialog({
  storeId,
  group,
  open,
  onOpenChange,
}: {
  storeId: string;
  /** Null to create. */
  group: OptionGroup | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: addonsRes } = useGetAddonsByStoreIdQuery(storeListPrefetchArg(storeId), { skip: !open });
  const addons = addonsRes?.data ?? [];
  const [create, creating] = useCreateOptionGroupMutation();
  const [update, updating] = useUpdateOptionGroupMutation();
  const busy = creating.isLoading || updating.isLoading;

  const form = useForm<Values>({
    resolver: zodResolver(Schema),
    values: {
      name: group?.name ?? "",
      minChoices: group?.minChoices ?? 1,
      maxChoices: group?.maxChoices ?? 1,
      pickPrices: group?.pickPrices ?? null,
      options: group?.options?.map((option) => ({ addonId: option.id, price: option.groupPrice })) ?? [],
    },
  });
  const values = useWatch({ control: form.control }) as Values;
  const [samePrice, setSamePrice] = useState<number | undefined>(undefined);
  const addonById = new Map(addons.map((addon) => [addon.id, addon]));
  const byPick = Boolean(values.pickPrices);

  const close = (next: boolean) => {
    if (busy) return;
    onOpenChange(next);
  };

  const submit = async (values: Values) => {
    // One price per pick up to the maximum (the API repeats the last one).
    const data = {
      ...values,
      pickPrices: values.pickPrices ? tiers(values.pickPrices, values.maxChoices) : null,
    };
    try {
      if (group) await update({ storeId, id: group.id, data }).unwrap();
      else await create({ storeId, data }).unwrap();
      toast.success(group ? "Grupo de escolha atualizado" : "Grupo de escolha criado");
      close(false);
    } catch (error) {
      form.setError("root", { message: getErrorMessage(error, "Não foi possível salvar o grupo.") });
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={close}
      // Cleared once closed: resetting during the exit animation flickers.
      onOpenChangeComplete={(next) => {
        if (next) return;
        form.reset();
        setSamePrice(undefined);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <form noValidate onSubmit={form.handleSubmit(submit)}>
          <DialogHeader>
            <DialogTitle>{group ? "Editar grupo de escolha" : "Novo grupo de escolha"}</DialogTitle>
            <DialogDescription>
              O cliente escolhe entre as opções ao pedir, ex.: o queijo do pastel ou até 2 molhos.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <FieldGroup>
              <Controller
                name="name"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="group-name">Nome</FieldLabel>
                    <Input
                      {...field}
                      id="group-name"
                      placeholder="Ex.: Escolha o queijo"
                      aria-invalid={fieldState.invalid}
                      disabled={busy}
                    />
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
              <Controller
                name="options"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="group-options">Opções</FieldLabel>
                    <MultiCombobox
                      id="group-options"
                      items={addons}
                      value={field.value.map((option) => option.addonId)}
                      // Options kept keep their price; new ones start at the add-on's.
                      onChange={(ids: string[]) =>
                        field.onChange(
                          ids.map(
                            (addonId) =>
                              field.value.find((option) => option.addonId === addonId) ?? { addonId, price: null }
                          )
                        )
                      }
                      getValue={(addon) => addon.id}
                      getLabel={(addon) => addon.name}
                      disabled={busy}
                      invalid={fieldState.invalid}
                      placeholder="Selecione os adicionais que viram opções"
                      emptyMessage="Nenhum adicional encontrado"
                    />
                    <FieldDescription>
                      As opções são adicionais da loja (com receita e estoque). O preço pode ser outro neste grupo: o
                      mesmo &quot;Carne&quot; sai a R$ 0 em &quot;Troque o recheio&quot; e a R$ 4 em &quot;Recheio
                      extra&quot;. Vazio, vale o preço do adicional.
                    </FieldDescription>
                    {field.value.length > 0 && byPick && (
                      <p className="rounded-lg border bg-muted/40 p-2 text-xs text-muted-foreground">
                        Preço pela ordem da escolha (abaixo): o preço de cada opção não vale neste grupo.
                      </p>
                    )}
                    {field.value.length > 0 && !byPick && (
                      <div className="flex flex-col rounded-lg border">
                        <div className="flex flex-wrap items-center gap-2 border-b bg-muted/40 p-2">
                          <span className="flex-1 text-xs font-medium text-muted-foreground">Mesmo preço para todas</span>
                          <MoneyInput
                            className="h-8 w-28"
                            aria-label="Preço para todas as opções"
                            placeholder="R$ 0,00"
                            value={samePrice}
                            onChange={setSamePrice}
                            disabled={busy}
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={busy || samePrice === undefined}
                            onClick={() =>
                              field.onChange(field.value.map((option) => ({ ...option, price: samePrice ?? null })))
                            }
                          >
                            Aplicar
                          </Button>
                        </div>
                        <ul className="divide-y">
                          {field.value.map((option, index) => {
                            // The group's own copy covers the add-ons list still loading.
                            const addon =
                              addonById.get(option.addonId) ??
                              group?.options?.find((saved) => saved.id === option.addonId);
                            const name = addon?.name ?? "";
                            const ownPrice = addon?.price ?? 0;
                            const setPrice = (price: number | null) =>
                              field.onChange(field.value.map((o, i) => (i === index ? { ...o, price } : o)));
                            return (
                              <li key={option.addonId} className="flex items-center gap-2 p-2">
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-sm font-medium">{name}</span>
                                  <span className="block text-xs text-muted-foreground">
                                    {option.price === null
                                      ? "Preço do adicional"
                                      : `No adicional: ${formatCurrencyBRL(ownPrice)}`}
                                  </span>
                                </span>
                                <MoneyInput
                                  className="h-8 w-28"
                                  aria-label={`Preço de ${name} neste grupo`}
                                  placeholder={formatCurrencyBRL(ownPrice)}
                                  value={option.price ?? undefined}
                                  onChange={setPrice}
                                  disabled={busy}
                                />
                                <Button
                                  type="button"
                                  size="icon-sm"
                                  variant="ghost"
                                  aria-label={`Usar o preço do adicional em ${name}`}
                                  className={option.price === null ? "invisible" : undefined}
                                  disabled={busy || option.price === null}
                                  onClick={() => setPrice(null)}
                                >
                                  <Undo2 />
                                </Button>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
              <div className="grid grid-cols-2 gap-3">
                <Controller
                  name="minChoices"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="group-min">Mínimo</FieldLabel>
                      <NumberStepper
                        id="group-min"
                        label="mínimo"
                        min={0}
                        max={20}
                        value={field.value}
                        onChange={field.onChange}
                        invalid={fieldState.invalid}
                        disabled={busy}
                      />
                      <FieldDescription>0 = opcional</FieldDescription>
                      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </Field>
                  )}
                />
                <Controller
                  name="maxChoices"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="group-max">Máximo</FieldLabel>
                      <NumberStepper
                        id="group-max"
                        label="máximo"
                        min={1}
                        max={20}
                        value={field.value}
                        onChange={field.onChange}
                        invalid={fieldState.invalid}
                        disabled={busy}
                      />
                      <FieldDescription>1 = uma escolha só</FieldDescription>
                      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </Field>
                  )}
                />
              </div>
              {values.maxChoices >= 1 && (
                <Controller
                  name="pickPrices"
                  control={form.control}
                  render={({ field }) => (
                    <div className="flex flex-col gap-3 rounded-lg border p-3">
                      <Field orientation="horizontal">
                        <Switch
                          id="group-pick-prices"
                          checked={byPick}
                          onCheckedChange={(checked) => field.onChange(checked ? tiers([], values.maxChoices) : null)}
                          disabled={busy}
                        />
                        <FieldContent>
                          <FieldLabel htmlFor="group-pick-prices">Preço pela ordem da escolha</FieldLabel>
                          <FieldDescription>
                            Ex.: o 1º recheio extra + R$ 3,00 e os outros + R$ 5,00, seja qual for a opção.
                          </FieldDescription>
                        </FieldContent>
                      </Field>
                      {byPick && field.value && (
                        <ul className="grid gap-2 sm:grid-cols-2">
                          {tiers(field.value, values.maxChoices).map((price, index, all) => (
                            <li key={index} className="flex items-center justify-between gap-2">
                              <span className="text-sm">{ordinal(index)}</span>
                              <MoneyInput
                                className="h-8 w-28"
                                aria-label={`Preço da ${ordinal(index)}`}
                                placeholder="R$ 0,00"
                                value={price}
                                onChange={(next) =>
                                  field.onChange(all.map((value, i) => (i === index ? (next ?? 0) : value)))
                                }
                                disabled={busy}
                              />
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                />
              )}
              {Number.isFinite(values.minChoices) && Number.isFinite(values.maxChoices) && values.maxChoices >= 1 && (
                <p className="text-sm text-muted-foreground">
                  O cliente vê: <strong className="text-foreground">{groupRule(values)}</strong>
                  {byPick && values.pickPrices && (
                    <> · {pickPricesLabel(tiers(values.pickPrices, values.maxChoices), values.maxChoices)}</>
                  )}
                </p>
              )}
              {form.formState.errors.root?.message && (
                <Alert variant="destructive">
                  <AlertDescription>{form.formState.errors.root.message}</AlertDescription>
                </Alert>
              )}
            </FieldGroup>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={() => close(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={busy}>
              {group ? "Salvar" : "Criar grupo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
