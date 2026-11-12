"use client";

import MoneyInput from "@/components/ui/money-input";
import { Button } from "@/components/ui/button";
import { formatCurrencyBRL } from "@/utils/string";
import { cn } from "@/lib/utils";

/** Notes the customer is likely to hand over for this total (the exact amount comes first). */
function suggestions(total: number) {
  const ups = [5, 10, 20, 50, 100, 200].flatMap((step) => {
    const value = Math.ceil(total / step) * step;
    return value > total ? [value] : [];
  });
  return [...new Set(ups)].sort((a, b) => a - b).slice(0, 3);
}

/**
 * "Valor recebido" with the change to give back. Optional: left empty, the
 * payment still goes (the cashier counted it by hand).
 */
export function CashChange({
  total,
  received,
  onReceived,
}: {
  total: number;
  received: number | undefined;
  onReceived: (value: number | undefined) => void;
}) {
  const typed = received !== undefined && received > 0;
  const change = typed ? (Math.round(received * 100) - Math.round(total * 100)) / 100 : null;

  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border bg-muted/30 p-3 text-center">
      <label className="flex w-full flex-col items-center gap-1.5">
        <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Valor recebido</span>
        <MoneyInput
          value={received}
          onChange={(value) => onReceived(value || undefined)}
          placeholder="R$ 0,00"
          aria-label="Valor recebido em dinheiro"
          className="h-11 bg-background text-center text-lg font-semibold tabular-nums"
        />
      </label>
      <div className="flex flex-wrap justify-center gap-2" aria-label="Valores comuns">
        <Button type="button" size="sm" variant="outline" className="rounded-full bg-background" onClick={() => onReceived(total)}>
          Exato
        </Button>
        {suggestions(total).map((value) => (
          <Button
            key={value}
            type="button"
            size="sm"
            variant="outline"
            className="rounded-full bg-background tabular-nums"
            onClick={() => onReceived(value)}
          >
            {formatCurrencyBRL(value)}
          </Button>
        ))}
      </div>
      {change !== null && (
        <p
          role="status"
          className={cn(
            "flex w-full flex-col items-center rounded-xl px-3 py-2",
            change >= 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
          )}
        >
          <span className="text-xs font-semibold tracking-wide uppercase">{change >= 0 ? "Troco" : "Faltam"}</span>
          <span className="text-3xl font-black tabular-nums">{formatCurrencyBRL(Math.abs(change))}</span>
        </p>
      )}
    </div>
  );
}

/** Received less than the total (compared in cents): the payment can't go yet. */
export function cashShort(total: number, received: number | undefined) {
  return received !== undefined && received > 0 && Math.round(received * 100) < Math.round(total * 100);
}
