"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { ShieldCheck } from "lucide-react";
import type { PublicOrder } from "@react-menu/contracts";
import { Button } from "@/components/ui/button";
import { useSyncPaymentMutation } from "@/redux/features/public/publicApi";

/** After the bank says "done", Mercado Pago may still be settling: ask a few times. */
const SYNC_TRIES = 5;
const SYNC_INTERVAL_MS = 2500;

const time = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

/**
 * 3-D Secure (ADR 0017): the card's bank asks the payer to confirm the
 * purchase on its own page, shown here in a frame. The bank's page posts
 * `{ status: "COMPLETE" }` when it ends; only then (or on "Já confirmei")
 * the order is read again. The frame's message is the only one trusted.
 */
export function CardChallenge({
  order,
  challenge,
}: {
  order: PublicOrder;
  challenge: { url: string; expiresAt: string | null };
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [sync] = useSyncPaymentMutation();
  const [checking, setChecking] = useState(false);
  const [stillPending, setStillPending] = useState(false);
  const token = order.publicToken;

  const check = async () => {
    setChecking(true);
    setStillPending(false);
    try {
      for (let attempt = 0; attempt < SYNC_TRIES; attempt++) {
        const fresh = await sync(token).unwrap();
        // Settled (approved, refused, expired): the panel re-renders without this frame.
        if (fresh.payment?.status !== "pending" || !fresh.payment.challenge) return;
        await new Promise((resolve) => setTimeout(resolve, SYNC_INTERVAL_MS));
      }
      setStillPending(true);
    } catch {
      setStillPending(true);
    } finally {
      setChecking(false);
    }
  };
  const onComplete = useEffectEvent(() => void check());

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow) return;
      if ((event.data as { status?: string } | null)?.status === "COMPLETE") onComplete();
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return (
    <section aria-labelledby="card-challenge-title" className="space-y-3">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <ShieldCheck className="size-5" aria-hidden />
        </span>
        <div className="space-y-0.5">
          <h3 id="card-challenge-title" className="font-semibold">
            Confirme a compra com o seu banco
          </h3>
          <p className="text-sm text-muted-foreground">
            Para a sua segurança, o banco pediu uma confirmação
            {challenge.expiresAt ? ` (até as ${time(challenge.expiresAt)})` : ""}. Siga as instruções abaixo.
          </p>
        </div>
      </div>
      <iframe
        ref={frame}
        src={challenge.url}
        title="Confirmação do banco"
        className="h-[min(70vh,560px)] w-full rounded-xl border bg-white"
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {checking
            ? "Conferindo com o banco…"
            : stillPending
              ? "O banco ainda não respondeu. Se já confirmou, aguarde um instante e tente de novo."
              : "O pedido é atualizado sozinho quando o banco responder."}
        </p>
        <Button variant="outline" size="sm" loading={checking} onClick={() => void check()}>
          Já confirmei
        </Button>
      </div>
    </section>
  );
}
