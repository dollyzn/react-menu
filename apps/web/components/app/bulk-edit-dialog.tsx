"use client";

import { useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowRight, PenLine, TriangleAlert } from "lucide-react";
import type { BulkUpdateChange } from "@react-menu/contracts";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import MoneyInput from "@/components/ui/money-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  MAX_PRICE,
  preview,
  toChanges,
  type BulkEditable,
  type PriceRule,
} from "@/lib/bulk-pricing";
import { getErrorMessage } from "@/utils/get-error-message";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const PRICE_MODES = [
  { value: "keep", label: "Manter os preços" },
  { value: "set", label: "Definir um preço" },
  { value: "increase", label: "Aumentar" },
  { value: "decrease", label: "Diminuir" },
];
const UNITS = [
  { value: "percent", label: "%" },
  { value: "amount", label: "R$" },
];
const ROUNDINGS = [
  { value: "none", label: "Não arredondar" },
  { value: "90", label: "Terminar em ,90" },
  { value: "050", label: "Múltiplo de R$ 0,50" },
];
const AVAILABILITY = [
  { value: "keep", label: "Manter como está" },
  { value: "available", label: "Disponível" },
  { value: "unavailable", label: "Esgotado" },
];

const parseAmount = (text: string) => Number(text.replace(",", ".")) || 0;

const Schema = z
  .object({
    priceMode: z.enum(["keep", "set", "increase", "decrease"]),
    setValue: z.number(),
    adjust: z.string(),
    unit: z.enum(["percent", "amount"]),
    rounding: z.enum(["none", "90", "050"]),
    availability: z.enum(["keep", "available", "unavailable"]),
  })
  .superRefine((values, ctx) => {
    if (values.priceMode === "keep" && values.availability === "keep") {
      ctx.addIssue({ code: "custom", path: ["priceMode"], message: "Escolha o que mudar: preço, disponibilidade ou os dois." });
    }
    if (values.priceMode === "set" && !(values.setValue > 0 && values.setValue <= MAX_PRICE)) {
      ctx.addIssue({ code: "custom", path: ["setValue"], message: "Informe o novo preço." });
    }
    if (values.priceMode === "increase" || values.priceMode === "decrease") {
      const amount = parseAmount(values.adjust);
      if (!(amount > 0)) {
        ctx.addIssue({ code: "custom", path: ["adjust"], message: "Informe quanto mudar." });
      } else if (values.priceMode === "decrease" && values.unit === "percent" && amount >= 100) {
        ctx.addIssue({ code: "custom", path: ["adjust"], message: "Para diminuir, use menos de 100%." });
      }
    }
  });

type Values = z.infer<typeof Schema>;

const DEFAULTS: Values = {
  priceMode: "keep",
  setValue: 0,
  adjust: "",
  unit: "percent",
  rounding: "none",
  availability: "keep",
};

function ruleOf(values: Values): PriceRule {
  if (values.priceMode === "keep") return { mode: "keep" };
  if (values.priceMode === "set") return { mode: "set", value: values.setValue };
  return {
    mode: values.priceMode,
    unit: values.unit,
    value: parseAmount(values.adjust),
    rounding: values.rounding,
  };
}

interface BulkEditDialogProps {
  rows: BulkEditable[];
  noun: { singular: string; plural: string };
  /** Saves the changes; throws on failure (409 when rows changed meanwhile). */
  onApply: (changes: BulkUpdateChange[]) => Promise<{ updated: number }>;
  onDone: () => void;
}

/**
 * Bulk edit of prices and availability for the selected rows (items or
 * add-ons): set a price, raise/lower by % or R$ (with rounding), mark
 * available/sold out. Shows every new price before saving; the API applies
 * all or nothing and refuses rows that changed since they were loaded.
 */
export function BulkEditDialog({ rows, noun, onApply, onDone }: BulkEditDialogProps) {
  const [open, setOpen] = useState(false);
  const [conflict, setConflict] = useState<string[]>([]);
  const form = useForm<Values>({ resolver: zodResolver(Schema), defaultValues: DEFAULTS });
  const values = useWatch({ control: form.control }) as Values;
  const busy = form.formState.isSubmitting;

  const rows_ = useMemo(
    () => preview(rows, ruleOf({ ...DEFAULTS, ...values }), values.availability ?? "keep"),
    [rows, values]
  );
  const changed = rows_.filter((row) => row.changed);
  const invalid = rows_.filter((row) => row.invalid);
  const label = rows.length === 1 ? `1 ${noun.singular}` : `${rows.length} ${noun.plural}`;
  const adjusting = values.priceMode === "increase" || values.priceMode === "decrease";

  const handleOpenChange = (next: boolean) => {
    if (busy) return;
    setOpen(next);
    if (!next) {
      form.reset(DEFAULTS);
      setConflict([]);
    }
  };

  const submit = async () => {
    if (invalid.length) return;
    const changes = toChanges(rows_);
    if (!changes.length) {
      toast.info("Nada muda com essas opções.");
      return;
    }
    try {
      const { updated } = await onApply(changes);
      toast.success(updated === 1 ? `1 ${noun.singular} atualizado` : `${updated} ${noun.plural} atualizados`, {
        id: "bulk-edit",
      });
      handleOpenChange(false);
      onDone();
    } catch (error) {
      const data = (error as { status?: number; data?: { code?: string; details?: { ids?: string[] } } })
        .data;
      if (data?.code === "E_STALE_ROWS") {
        // The list refetches; the preview follows the fresh values.
        setConflict(data.details?.ids ?? []);
        return;
      }
      toast.error(getErrorMessage(error, "Não foi possível salvar. Tente de novo."));
    }
  };

  const conflictNames = rows.filter((row) => conflict.includes(row.id)).map((row) => row.name);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button
            size="icon"
            className="h-8 w-8"
            variant="ghost"
            aria-label="Editar selecionados"
            disabled={!rows.length}
          />
        }
      >
        <PenLine />
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar {label}</DialogTitle>
          <DialogDescription>Confira os valores novos na prévia antes de aplicar.</DialogDescription>
        </DialogHeader>
        <form noValidate onSubmit={form.handleSubmit(submit)}>
          <DialogBody>
            <FieldGroup>
              {conflict.length > 0 && (
                <Alert variant="destructive">
                  <TriangleAlert />
                  <AlertTitle>Alguns itens mudaram enquanto você editava</AlertTitle>
                  <AlertDescription>
                    {conflictNames.length ? `${conflictNames.join(", ")}. ` : ""}
                    Nada foi salvo. A prévia já mostra os valores atuais: confira e aplique de novo.
                  </AlertDescription>
                </Alert>
              )}

              <Controller
                name="priceMode"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel>Preço</FieldLabel>
                    <Select items={PRICE_MODES} value={field.value} onValueChange={field.onChange} disabled={busy}>
                      <SelectTrigger aria-label="Como mudar o preço" aria-invalid={fieldState.invalid}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PRICE_MODES.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />

              {values.priceMode === "set" && (
                <Controller
                  name="setValue"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="bulk-set-price">Novo preço para todos</FieldLabel>
                      <MoneyInput
                        id="bulk-set-price"
                        value={field.value}
                        onChange={field.onChange}
                        disabled={busy}
                        aria-invalid={fieldState.invalid}
                      />
                      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </Field>
                  )}
                />
              )}

              {adjusting && (
                <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                  <Controller
                    name="adjust"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="bulk-adjust">
                          {values.priceMode === "increase" ? "Aumentar em" : "Diminuir em"}
                        </FieldLabel>
                        <div className="flex gap-2">
                          <Input
                            {...field}
                            id="bulk-adjust"
                            inputMode="decimal"
                            placeholder={values.unit === "percent" ? "10" : "1,50"}
                            disabled={busy}
                            aria-invalid={fieldState.invalid}
                          />
                          <Select
                            items={UNITS}
                            value={values.unit}
                            onValueChange={(value) => form.setValue("unit", value as Values["unit"])}
                            disabled={busy}
                          >
                            <SelectTrigger className="w-20" aria-label="Unidade">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {UNITS.map((item) => (
                                <SelectItem key={item.value} value={item.value}>
                                  {item.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                      </Field>
                    )}
                  />
                  <Field>
                    <FieldLabel>Arredondar</FieldLabel>
                    <Select
                      items={ROUNDINGS}
                      value={values.rounding}
                      onValueChange={(value) => form.setValue("rounding", value as Values["rounding"])}
                      disabled={busy}
                    >
                      <SelectTrigger className="sm:w-48" aria-label="Arredondar">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROUNDINGS.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
              )}

              <Field>
                <FieldLabel>Disponibilidade</FieldLabel>
                <Select
                  items={AVAILABILITY}
                  value={values.availability}
                  onValueChange={(value) => {
                    form.setValue("availability", value as Values["availability"]);
                    void form.trigger("priceMode");
                  }}
                  disabled={busy}
                >
                  <SelectTrigger aria-label="Disponibilidade">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABILITY.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldDescription>Esgotado some do cardápio até voltar a ficar disponível.</FieldDescription>
              </Field>

              <section aria-label="Prévia" className="rounded-xl border">
                <p className="flex items-center justify-between border-b px-3 py-2 text-sm font-medium">
                  Prévia
                  <span className="text-xs font-normal text-muted-foreground">
                    {changed.length} de {rows.length} mudam
                  </span>
                </p>
                <ul className="max-h-60 divide-y overflow-y-auto">
                  {rows_.map((row) => (
                    <li
                      key={row.id}
                      className={cn("flex items-center gap-2 px-3 py-2 text-sm", !row.changed && "text-muted-foreground")}
                    >
                      <span className="min-w-0 flex-1 truncate">{row.name}</span>
                      {row.newAvailable !== row.isAvailable && (
                        <Badge variant={row.newAvailable ? "secondary" : "outline"}>
                          {row.newAvailable ? "Disponível" : "Esgotado"}
                        </Badge>
                      )}
                      <span className="tabular-nums">
                        {row.newPrice !== row.price ? (
                          <span className="inline-flex items-center gap-1">
                            <s className="text-muted-foreground">{money.format(row.price)}</s>
                            <ArrowRight className="size-3 text-muted-foreground" aria-label="para" />
                            <span className={cn("font-semibold", row.invalid && "text-destructive")}>
                              {row.invalid ? "inválido" : money.format(row.newPrice)}
                            </span>
                          </span>
                        ) : (
                          money.format(row.price)
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
              {invalid.length > 0 && (
                <p role="alert" className="text-sm text-destructive">
                  {invalid.length === 1 ? "1 preço ficaria" : `${invalid.length} preços ficariam`} zerado ou
                  negativo. Ajuste o valor.
                </p>
              )}
            </FieldGroup>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={() => handleOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={busy} disabled={invalid.length > 0}>
              Aplicar a {changed.length || rows.length}{" "}
              {(changed.length || rows.length) === 1 ? noun.singular : noun.plural}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
