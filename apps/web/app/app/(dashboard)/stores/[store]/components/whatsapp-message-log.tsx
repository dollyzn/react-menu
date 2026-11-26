"use client";

import { useState } from "react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Check, CheckCheck, ChevronDown, CircleAlert, Clock, MinusCircle } from "lucide-react";
import type { WhatsAppMessageLog } from "@react-menu/contracts";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useGetWhatsAppMessagesQuery } from "@/redux/features/whatsapp/whatsappApi";
import { cn } from "@/lib/utils";
import { GROW } from "./whatsapp-notices";

const KIND: Record<WhatsAppMessageLog["kind"], string> = {
  order_received: "Pedido recebido",
  order_preparing: "Em preparo",
  order_ready: "Pronto para retirar",
  order_completed: "Retirado",
  order_cancelled: "Cancelado",
  login_code: "Código de acesso",
  login_reply: "Confirmação de acesso",
};

/** Each status the way WhatsApp shows it: a clock, one tick, two ticks, two colored ticks. */
const STATUS: Record<WhatsAppMessageLog["status"], { label: string; icon: typeof Check; tone: string }> = {
  queued: { label: "Na fila", icon: Clock, tone: "text-muted-foreground" },
  sent: { label: "Enviada", icon: Check, tone: "text-muted-foreground" },
  delivered: { label: "Entregue", icon: CheckCheck, tone: "text-muted-foreground" },
  read: { label: "Lida", icon: CheckCheck, tone: "text-whatsapp" },
  failed: { label: "Falhou", icon: CircleAlert, tone: "text-destructive" },
  skipped: { label: "Não enviada", icon: MinusCircle, tone: "text-muted-foreground" },
};

const SHORT = 8;


/** What went out through the store's number: today's count and the last messages. */
export function WhatsAppMessageLog({ storeId }: { storeId: string }) {
  const { data, isLoading } = useGetWhatsAppMessagesQuery(storeId, { pollingInterval: 30_000 });
  const [all, setAll] = useState(false);
  if (isLoading) return null;
  const messages = data?.data ?? [];
  const today = data?.meta.today;
  const sentToday = today ? today.sent + today.delivered + today.read : 0;

  return (
    <section aria-labelledby="whatsapp-messages" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="whatsapp-messages" className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Últimas mensagens
        </h3>
        {today && (
          <p className="text-xs text-muted-foreground tabular-nums">
            Hoje: {sentToday} {sentToday === 1 ? "enviada" : "enviadas"} · {today.read}{" "}
            {today.read === 1 ? "lida" : "lidas"}
            {today.failed > 0 && <span className="text-destructive"> · {today.failed} com falha</span>}
          </p>
        )}
      </div>

      {messages.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-4 text-center text-sm text-muted-foreground">
          Nenhuma mensagem ainda. Os avisos aparecem aqui quando um cliente pedir para recebê-los no checkout.
        </p>
      ) : (
        <Collapsible open={all} onOpenChange={setAll} className="flex flex-col gap-2">
          <div className="overflow-hidden rounded-2xl border text-sm">
            <ul className="divide-y">
              {messages.slice(0, SHORT).map((message) => (
                <MessageItem key={message.id} message={message} />
              ))}
            </ul>
            {messages.length > SHORT && (
              <CollapsibleContent className={GROW}>
                <ul className="divide-y border-t">
                  {messages.slice(SHORT).map((message) => (
                    <MessageItem key={message.id} message={message} />
                  ))}
                </ul>
              </CollapsibleContent>
            )}
          </div>
          {messages.length > SHORT && (
            <CollapsibleTrigger
              render={<Button variant="ghost" size="sm" className="group self-center" />}
            >
              {all ? "Mostrar menos" : `Ver as ${messages.length} últimas`}
              <ChevronDown className="transition-transform duration-200 group-data-[panel-open]:rotate-180 motion-reduce:transition-none" />
            </CollapsibleTrigger>
          )}
        </Collapsible>
      )}
    </section>
  );
}

function MessageItem({ message }: { message: WhatsAppMessageLog }) {
  const status = STATUS[message.status];
  return (
    <li className="flex items-start gap-3 p-3">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">
          {KIND[message.kind]}
          {message.orderNumber !== null && (
            <span className="font-normal text-muted-foreground"> · pedido #{message.orderNumber}</span>
          )}
        </p>
        <p className="truncate text-xs text-muted-foreground tabular-nums">
          {message.customerName ? `${message.customerName} · ` : ""}
          {message.to} · {formatDistanceToNow(parseISO(message.createdAt), { addSuffix: true, locale: ptBR })}
        </p>
        {message.errorTitle && (
          <p className="mt-0.5 text-xs text-destructive">
            {message.errorTitle}
            {message.errorCode ? ` (${message.errorCode})` : ""}
          </p>
        )}
      </div>
      <span className={cn("flex shrink-0 items-center gap-1 text-xs font-medium", status.tone)}>
        <status.icon className="size-4" /> {status.label}
      </span>
    </li>
  );
}
