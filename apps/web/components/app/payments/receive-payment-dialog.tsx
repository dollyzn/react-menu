"use client";

import { useState, type ReactNode } from "react";
import { Check, ReceiptText, TriangleAlert } from "lucide-react";
import type { CounterPaymentMethod } from "@react-menu/contracts";
import { Button } from "@/components/ui/button";
import { ResponsiveModal } from "@/components/app/responsive-modal";
import { formatCurrencyBRL } from "@/utils/string";
import { cn } from "@/lib/utils";
import { CashChange, cashShort } from "./cash-change";
import { COUNTER_METHOD_ORDER, COUNTER_METHODS, MACHINE } from "./counter-methods";

export type ReceiveChoice = CounterPaymentMethod | "machine";

/**
 * "Receber pagamento": the amount, how the customer paid (the card machine
 * integrated with the system, or cash/Pix/credit/debit recorded by hand) and,
 * in cash, the change. Used on the orders board ("Entregar", the card's menu)
 * and by the POS ("Dinheiro").
 */
export function ReceivePaymentDialog({
  open,
  onClose,
  title,
  badge,
  total,
  verb = "Receber",
  canCharge,
  methods = COUNTER_METHOD_ORDER,
  initial = null,
  busy,
  error,
  onConfirm,
  children,
}: {
  open: boolean;
  onClose: () => void;
  /** For screen readers ("Receber o pedido #12"). */
  title: string;
  /** The pill over the amount ("Pedido #12 · Ana"). */
  badge: string;
  total: number;
  /** "Receber", "Receber e entregar", "Enviar": the confirm button's verb. */
  verb?: string;
  /** The store's card machine is on: offer it first. */
  canCharge: boolean;
  methods?: CounterPaymentMethod[];
  initial?: ReceiveChoice | null;
  busy: boolean;
  error: string | null;
  onConfirm: (choice: ReceiveChoice) => void;
  /** Above the methods (the items to check before delivering). */
  children?: ReactNode;
}) {
  const [choice, setChoice] = useState<ReceiveChoice | null>(initial);
  const [received, setReceived] = useState<number | undefined>(undefined);
  // A new opening starts from what the caller asks (state is reset once closed).
  const [lastInitial, setLastInitial] = useState(initial);
  if (open && initial !== lastInitial) {
    setLastInitial(initial);
    setChoice(initial);
  }

  const choices: ReceiveChoice[] = [...(canCharge ? (["machine"] as const) : []), ...methods];
  const short = choice === "cash" && cashShort(total, received);
  const change = choice === "cash" && received && received > total ? received - total : 0;
  const confirmLabel =
    choice === "machine"
      ? `Cobrar ${formatCurrencyBRL(total)} na maquininha`
      : choice
        ? `${verb} · ${COUNTER_METHODS[choice].label}${change > 0 ? ` · troco ${formatCurrencyBRL(change)}` : ""}`
        : "Escolha como o cliente pagou";

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(next) => !next && !busy && onClose()}
      // Cleared once closed, never while it animates out.
      onOpenChangeComplete={(next) => {
        if (next) return;
        setChoice(initial);
        setReceived(undefined);
      }}
      title={title}
      description="Escolha como o cliente pagou."
      hideHeader
      className="sm:max-w-md"
    >
      <div className="flex flex-col">
        {/* The amount first, as on the card machine's dialog. */}
        <header className="flex flex-col items-center gap-2 px-4 pt-6 pb-5 text-center">
          <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
            <ReceiptText className="size-3.5 shrink-0" />
            <span className="truncate">{badge}</span>
          </span>
          <p className="text-4xl font-black tracking-tight tabular-nums">{formatCurrencyBRL(total)}</p>
          <p className="text-sm text-muted-foreground">a receber</p>
        </header>

        <div className="flex flex-col gap-5 px-4 pb-4">
          {children}

          {choices.length > 1 && (
            <section className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Como o cliente pagou
              </h3>
              <div className="grid grid-cols-2 gap-2" role="group" aria-label="Forma de pagamento">
                {choices.map((value) => {
                  const { label, hint, icon: Icon } = value === "machine" ? MACHINE : COUNTER_METHODS[value];
                  const selected = choice === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={selected}
                      disabled={busy}
                      onClick={() => setChoice(value)}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-2xl border bg-card p-3 text-left transition-all outline-none",
                        "hover:border-primary/40 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60",
                        selected && "border-primary bg-primary/5 shadow-sm",
                        value === "machine" && "col-span-2"
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground transition-colors",
                          selected && "bg-primary text-primary-foreground"
                        )}
                      >
                        <Icon className="size-5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold">{label}</span>
                        <span className="block text-xs leading-tight text-muted-foreground">{hint}</span>
                      </span>
                      {selected && (
                        <span className="absolute top-2 right-2 flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <Check className="size-3" strokeWidth={3} />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {choice === "cash" && <CashChange total={total} received={received} onReceived={setReceived} />}

          {error && (
            <p role="alert" className="flex items-start gap-2 rounded-2xl bg-destructive/10 p-3 text-sm text-destructive">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" /> {error}
            </p>
          )}
        </div>

        <div className="flex flex-col items-center gap-2 border-t bg-muted/30 p-4">
          <Button
            size="lg"
            className="h-12 w-full rounded-xl text-base shadow-sm"
            disabled={!choice || short}
            loading={busy}
            onClick={() => choice && onConfirm(choice)}
          >
            {confirmLabel}
          </Button>
          <Button variant="ghost" className="w-full" disabled={busy} onClick={onClose}>
            Voltar
          </Button>
        </div>
      </div>
    </ResponsiveModal>
  );
}
