"use client";

import { useState } from "react";
import { HandCoins, Phone, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ResponsiveModal } from "@/components/app/responsive-modal";
import { formatCurrencyBRL, formatPhoneBR } from "@/utils/string";

/** A Brazilian mobile or landline with the area code: 10 or 11 digits. */
export const phoneComplete = (phone: string) => /^\d{10,11}$/.test(phone.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, ""));

/**
 * "Pagar depois" (fiado): the customer settles it another day. The order is
 * handed over without a payment and the managers follow it in "Pagar depois".
 * Asks for the phone (who to charge), filled with the one already known.
 */
export function PayLaterDialog({
  open,
  onClose,
  badge,
  total,
  phone: knownPhone,
  verb,
  busy,
  error,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  /** The pill over the amount ("Pedido #12 · Ana", "Novo pedido · Ana"). */
  badge: string;
  total: number;
  /** The phone already known (the ticket's or the order's), any format. */
  phone: string | null;
  /** The confirm button ("Enviar para pagar depois"). */
  verb: string;
  busy: boolean;
  error: string | null;
  onConfirm: (phone: string) => void;
}) {
  const initial = knownPhone ? formatPhoneBR(knownPhone.replace(/^55(?=\d{10,11}$)/, "")) : "";
  const [phone, setPhone] = useState(initial);
  // A new opening starts from the phone known then (state is reset once closed).
  const [lastInitial, setLastInitial] = useState(initial);
  if (open && initial !== lastInitial) {
    setLastInitial(initial);
    setPhone(initial);
  }
  const ready = phoneComplete(phone);

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(next) => !next && !busy && onClose()}
      onOpenChangeComplete={(next) => !next && setPhone(initial)}
      title="Pagar depois"
      description="O pedido é entregue sem receber agora e fica em Pagar depois até ser pago."
      hideHeader
      className="sm:max-w-md"
    >
      <form
        className="flex flex-col"
        onSubmit={(event) => {
          event.preventDefault();
          if (ready && !busy) onConfirm(phone.replace(/\D/g, ""));
        }}
      >
        <header className="flex flex-col items-center gap-2 px-4 pt-6 pb-5 text-center">
          <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
            <HandCoins className="size-3.5 shrink-0" />
            <span className="truncate">{badge}</span>
          </span>
          <p className="text-4xl font-black tracking-tight tabular-nums">{formatCurrencyBRL(total)}</p>
          <p className="text-sm text-muted-foreground">para pagar depois</p>
        </header>

        <div className="flex flex-col gap-3 px-4 pb-4">
          <p className="text-sm text-balance text-muted-foreground">
            O pedido vai para a cozinha e é entregue sem receber agora. Ele fica em{" "}
            <span className="font-medium text-foreground">Pagar depois</span> até o cliente pagar.
          </p>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Celular de quem vai pagar
            </span>
            <span className="relative">
              <Phone className="pointer-events-none absolute inset-y-0 left-3 my-auto size-4 text-muted-foreground" />
              <Input
                type="tel"
                inputMode="tel"
                autoComplete="off"
                value={phone}
                onChange={(event) => setPhone(formatPhoneBR(event.target.value))}
                placeholder="(13) 99999-9999"
                aria-label="Celular de quem vai pagar depois"
                className="h-11 pl-9 text-base"
              />
            </span>
          </label>
          {error && (
            <p role="alert" className="flex items-start gap-2 rounded-2xl bg-destructive/10 p-3 text-sm text-destructive">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" /> {error}
            </p>
          )}
        </div>

        <div className="flex flex-col items-center gap-2 border-t bg-muted/30 p-4">
          <Button type="submit" size="lg" className="h-12 w-full rounded-xl text-base shadow-sm" disabled={!ready} loading={busy}>
            <HandCoins /> {ready ? verb : "Informe o celular com DDD"}
          </Button>
          <Button type="button" variant="ghost" className="w-full" disabled={busy} onClick={onClose}>
            Voltar
          </Button>
        </div>
      </form>
    </ResponsiveModal>
  );
}
