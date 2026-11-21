"use client";

import { Controller, useForm, useWatch, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Percent, Ticket } from "lucide-react";
import type { PartnerCommissionType, PartnerInput } from "@react-menu/contracts";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
import MoneyInput from "@/components/ui/money-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { commissionFor } from "@/lib/partner-commission";
import { formatCurrencyBRL } from "@/utils/string";
import {
  CANCEL_POLICIES,
  CANCEL_POLICY_ITEMS,
  COMMISSION_TYPES,
  EMPTY_PARTNER,
  partnerSchema,
  type PartnerFormValues,
} from "./partner-rules";

/** A partner's name and rules as a form (react-hook-form + zod; the API checks them too). */
export function usePartnerForm(values: PartnerInput = EMPTY_PARTNER) {
  return useForm<PartnerFormValues>({ resolver: zodResolver(partnerSchema), defaultValues: values });
}

const TYPE_ICON: Record<PartnerCommissionType, typeof Percent> = { percent: Percent, per_unit: Ticket };

/**
 * A partner's name and rules (ADR 0024): the commission, set before the
 * first sale so the partner sees it from the start, and up to when they
 * cancel alone. Shared by "Novo parceiro", the partner's settings and the
 * invite of a partner who doesn't exist yet.
 */
export function PartnerRuleFields({
  form,
  disabled,
  idPrefix = "partner",
}: {
  form: UseFormReturn<PartnerFormValues>;
  disabled?: boolean;
  idPrefix?: string;
}) {
  const { control } = form;
  const [type, value, policy] = useWatch({ control, name: ["commissionType", "commissionValue", "cancelPolicy"] });
  const example = commissionFor({ type, value: Number.isFinite(value) ? value : 0 }, { subtotal: 45, units: 3 });

  return (
    <FieldGroup>
      <Controller
        name="name"
        control={control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={`${idPrefix}-name`}>Nome do parceiro</FieldLabel>
            <Input
              {...field}
              id={`${idPrefix}-name`}
              placeholder="Ex.: Açaí da Praça"
              autoComplete="off"
              maxLength={80}
              disabled={disabled}
              aria-invalid={fieldState.invalid}
            />
            <FieldDescription>Aparece no quadro e na cozinha para saber de quem é o pedido.</FieldDescription>
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />

      <Field>
        <FieldLabel>Como a comissão é calculada</FieldLabel>
        <Controller
          name="commissionType"
          control={control}
          render={({ field }) => (
            <ToggleGroup
              aria-label="Como a comissão é calculada"
              variant="outline"
              value={[field.value]}
              onValueChange={(next: string[]) => {
                if (!next[0]) return;
                field.onChange(next[0] as PartnerCommissionType);
                form.setValue("commissionValue", next[0] === "percent" ? 10 : 1, { shouldDirty: true });
              }}
              disabled={disabled}
              className="w-full"
            >
              {(Object.keys(COMMISSION_TYPES) as PartnerCommissionType[]).map((option) => {
                const Icon = TYPE_ICON[option];
                return (
                  <ToggleGroupItem key={option} value={option} className="flex-1">
                    <Icon /> {COMMISSION_TYPES[option]}
                  </ToggleGroupItem>
                );
              })}
            </ToggleGroup>
          )}
        />
      </Field>

      <Controller
        name="commissionValue"
        control={control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={`${idPrefix}-commission`}>
              {type === "percent" ? "Porcentagem de cada venda" : "Valor por unidade vendida"}
            </FieldLabel>
            {type === "percent" ? (
              <InputGroup className="max-w-40">
                <InputGroupInput
                  id={`${idPrefix}-commission`}
                  inputMode="decimal"
                  value={Number.isFinite(field.value) ? String(field.value).replace(".", ",") : ""}
                  onChange={(event) => {
                    const text = event.target.value.replace(",", ".").replace(/[^\d.]/g, "");
                    field.onChange(text === "" ? Number.NaN : Number(text));
                  }}
                  onBlur={field.onBlur}
                  disabled={disabled}
                  aria-invalid={fieldState.invalid}
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupText>%</InputGroupText>
                </InputGroupAddon>
              </InputGroup>
            ) : (
              <MoneyInput
                id={`${idPrefix}-commission`}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                disabled={disabled}
                aria-invalid={fieldState.invalid}
                className="max-w-40"
              />
            )}
            <div className="rounded-lg bg-muted/60 px-3 py-2 text-sm">
              Ex.: 3 pastéis de R$ 15 rendem <span className="font-semibold text-success">{formatCurrencyBRL(example)}</span> ao
              parceiro.
            </div>
            <FieldDescription>Mudar depois vale só para as vendas novas; o parceiro é avisado.</FieldDescription>
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />

      <Controller
        name="cancelPolicy"
        control={control}
        render={({ field }) => (
          <Field>
            <FieldLabel htmlFor={`${idPrefix}-cancel`}>Cancelamento pelo parceiro</FieldLabel>
            <Select
              items={CANCEL_POLICY_ITEMS}
              value={field.value}
              onValueChange={(next) => next && field.onChange(next)}
              disabled={disabled}
            >
              <SelectTrigger id={`${idPrefix}-cancel`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CANCEL_POLICY_ITEMS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldDescription>
              {CANCEL_POLICIES[policy].description} Uma venda ainda não paga o parceiro sempre descarta.
            </FieldDescription>
          </Field>
        )}
      />
    </FieldGroup>
  );
}
