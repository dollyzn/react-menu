"use client";

import { toast } from "sonner";
import type { StorePartner } from "@react-menu/contracts";
import { PartnerRuleFields, usePartnerForm } from "@/components/app/partner/partner-rule-fields";
import type { PartnerFormValues } from "@/components/app/partner/partner-rules";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useUpdatePartnerMutation } from "@/redux/features/partner/partnersApi";

const since = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Sao_Paulo" });

/** Name, commission and cancellation rule (react-hook-form + zod). A new commission is told to the partner. */
export function RulesCard({ storeId, partner }: { storeId: string; partner: StorePartner }) {
  const form = usePartnerForm({
    name: partner.name,
    commissionType: partner.commissionType,
    commissionValue: partner.commissionValue,
    cancelPolicy: partner.cancelPolicy,
  });
  const [update, { isLoading }] = useUpdatePartnerMutation();
  const { isDirty } = form.formState;

  const submit = async (values: PartnerFormValues) => {
    const changed =
      values.commissionType !== partner.commissionType || values.commissionValue !== partner.commissionValue;
    const saved = await update({ storeId, partnerId: partner.id, input: { ...values, name: values.name.trim() } }).unwrap();
    form.reset({
      name: saved.name,
      commissionType: saved.commissionType,
      commissionValue: saved.commissionValue,
      cancelPolicy: saved.cancelPolicy,
    });
    toast.success(changed ? "Regras salvas. O parceiro foi avisado da nova comissão." : "Regras salvas");
  };

  return (
    <Card>
      <form onSubmit={form.handleSubmit(submit)} noValidate className="contents">
        <CardHeader>
          <CardTitle>Regras</CardTitle>
          <CardDescription>Comissão atual desde {since(partner.commissionUpdatedAt)}. Cada venda guarda a comissão do dia em que foi feita.</CardDescription>
        </CardHeader>
        <CardContent>
          <PartnerRuleFields form={form} disabled={isLoading} idPrefix="edit-partner" />
        </CardContent>
        <CardFooter className="justify-end gap-2 border-t">
          <Button type="button" variant="outline" disabled={!isDirty || isLoading} onClick={() => form.reset()}>
            Desfazer alterações
          </Button>
          <Button type="submit" disabled={!isDirty} loading={isLoading}>
            Salvar regras
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
