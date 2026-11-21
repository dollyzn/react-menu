"use client";

import { CalendarCheck, HandCoins, Undo2 } from "lucide-react";
import type { PartnerCommissionTotals, PartnerSettlement } from "@react-menu/contracts";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@/components/ui/item";
import { formatDay } from "@/lib/report-period";
import { cn } from "@/lib/utils";
import { formatCurrencyBRL } from "@/utils/string";

const orders = (value: number) => (value === 1 ? "1 pedido" : `${value} pedidos`);
const sales = (count: number) => (count === 1 ? "1 venda" : `${count} vendas`);
const when = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Sao_Paulo" });

/**
 * Where a partner's commission is (ADR 0024), whatever the period: to pay,
 * in progress, already paid. The managers' overview and the partner's own screen.
 */
export function CommissionState({
  totals,
  audience = "store",
}: {
  totals: PartnerCommissionTotals;
  /** The partner reads it from their side ("a receber"). */
  audience?: "store" | "partner";
}) {
  const parts = [
    {
      label: audience === "partner" ? "A receber" : "A pagar",
      hint: audience === "partner" ? "já entregues a você" : "já entregues ao parceiro",
      value: totals.toReceive,
      tone: "text-success",
    },
    { label: "Em andamento", hint: "pagos, ainda na loja", value: totals.inProgress, tone: "" },
    { label: audience === "partner" ? "Recebido" : "Já pago", hint: "nos acertos", value: totals.received, tone: "text-muted-foreground" },
  ];
  return (
    <Card className="py-0">
      <CardContent className="grid divide-y px-0 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {parts.map((part) => (
          <div key={part.label} className="flex flex-col gap-0.5 px-4 py-3">
            <span className="text-sm text-muted-foreground">{part.label}</span>
            <span className={cn("text-xl font-semibold tabular-nums", part.tone)}>{formatCurrencyBRL(part.value.amount)}</span>
            <span className="text-xs text-muted-foreground">
              {orders(part.value.orders)} {part.hint}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/** The settlements recorded: when, how much, up to which day, who. Managers can undo one. */
export function SettlementList({
  settlements,
  onUndo,
}: {
  settlements: PartnerSettlement[];
  onUndo?: (settlement: PartnerSettlement) => void;
}) {
  if (settlements.length === 0) {
    return (
      <Empty className="border border-dashed py-8">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <HandCoins />
          </EmptyMedia>
          <EmptyTitle>Nenhum acerto ainda</EmptyTitle>
          <EmptyDescription>Quando a comissão for marcada como paga, ela aparece aqui.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }
  return (
    <ItemGroup className="gap-2">
      {settlements.map((settlement) => (
        <Item key={settlement.id} variant="outline" size="sm">
          <ItemMedia variant="icon">
            <CalendarCheck />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>
              {formatCurrencyBRL(settlement.total)} · {sales(settlement.ordersCount)}
            </ItemTitle>
            <ItemDescription>
              Pago em {when(settlement.paidAt)}
              {settlement.until ? ` · vendas até ${formatDay(settlement.until)}` : " · vendas escolhidas"}
              {settlement.paidBy?.name ? ` · por ${settlement.paidBy.name}` : ""}
              {settlement.note ? ` · ${settlement.note}` : ""}
            </ItemDescription>
          </ItemContent>
          {onUndo && (
            <ItemActions>
              <Button variant="ghost" size="sm" onClick={() => onUndo(settlement)}>
                <Undo2 /> Desfazer
              </Button>
            </ItemActions>
          )}
        </Item>
      ))}
    </ItemGroup>
  );
}
