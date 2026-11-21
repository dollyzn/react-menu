"use client";

import { useParams } from "next/navigation";
import { PageHeader } from "@/components/app/layout/page-header";
import { PartnerAreaGate } from "@/components/app/partner/partner-area-gate";
import { CommissionState, SettlementList } from "@/components/app/partner/commission-state";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { commissionRuleLabel } from "@/lib/partner-commission";
import { useGetPartnerCommissionQuery } from "@/redux/features/partner/partnerAreaApi";

const since = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Sao_Paulo" });

/**
 * The partner's commission (ADR 0024): the rule, what the store still has
 * to pay, what is in progress and what it already paid (each settlement).
 * Same pieces as the managers' screen, read from the partner's side.
 */
export default function PartnerCommissionPage() {
  const { store: storeId } = useParams<{ store: string }>();
  return (
    <PartnerAreaGate storeId={storeId} managersOnly>
      <PartnerCommission storeId={storeId} />
    </PartnerAreaGate>
  );
}

function PartnerCommission({ storeId }: { storeId: string }) {
  const { data } = useGetPartnerCommissionQuery(storeId);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-4 md:p-6">
      <PageHeader
        title="Comissão"
        description={
          data
            ? `Regra atual: ${commissionRuleLabel(data.rule)}, desde ${since(data.rule.since)}. Cada venda guarda a comissão do dia em que foi feita.`
            : "O que a loja tem a pagar a você."
        }
      />
      {!data ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      ) : (
        <>
          <CommissionState totals={data.totals} audience="partner" />
          <Card>
            <CardHeader>
              <CardTitle>Acertos</CardTitle>
              <CardDescription>Cada vez que a loja marcou a sua comissão como paga.</CardDescription>
            </CardHeader>
            <CardContent>
              <SettlementList settlements={data.settlements} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
