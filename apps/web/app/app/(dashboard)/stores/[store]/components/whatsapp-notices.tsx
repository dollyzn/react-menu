"use client";

import { ChevronDown, ExternalLink } from "lucide-react";
import type { WhatsAppNotice, WhatsAppTemplate } from "@react-menu/contracts";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

const TEMPLATE_STATUS: Record<string, { label: string; tone: string }> = {
  APPROVED: { label: "Aprovado", tone: "bg-success/15 text-success" },
  PENDING: { label: "Em análise", tone: "bg-warning/15 text-warning" },
  IN_APPEAL: { label: "Em recurso", tone: "bg-warning/15 text-warning" },
  REJECTED: { label: "Recusado", tone: "bg-destructive/10 text-destructive" },
  PAUSED: { label: "Pausado", tone: "bg-destructive/10 text-destructive" },
  DISABLED: { label: "Desativado", tone: "bg-destructive/10 text-destructive" },
  MISSING: { label: "Não criado", tone: "bg-muted text-muted-foreground" },
};

/** Meta's review of a template, as a small pill. */
export function TemplateStatus({ template }: { template: WhatsAppTemplate }) {
  const status = TEMPLATE_STATUS[template.status] ?? { label: template.status, tone: "bg-muted text-muted-foreground" };
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap", status.tone)}>
      {status.label}
    </span>
  );
}

/** WhatsApp's *bold* as <strong>; everything else as plain text (never HTML). */
function WhatsAppText({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*[^*\n]+\*)/g).map((part, index) =>
        part.startsWith("*") && part.endsWith("*") && part.length > 2 ? (
          <strong key={index}>{part.slice(1, -1)}</strong>
        ) : (
          <span key={index}>{part}</span>
        )
      )}
    </>
  );
}

/** The message as the customer sees it in WhatsApp (example values). */
function MessagePreview({ preview }: { preview: WhatsAppNotice["preview"] }) {
  return (
    <div className="rounded-xl bg-[#efeae2] p-3 dark:bg-[#0b141a]">
      <div className="max-w-sm overflow-hidden rounded-lg rounded-tl-none bg-white text-sm text-[#111b21] shadow-xs dark:bg-[#202c33] dark:text-[#e9edef]">
        <p className="px-3 pt-2 pb-1.5 whitespace-pre-line">
          <WhatsAppText text={preview.text} />
        </p>
        {preview.button && (
          <p className="flex items-center justify-center gap-1.5 border-t border-black/10 py-2 font-medium text-[#008069] dark:border-white/10 dark:text-[#00a884]">
            <ExternalLink className="size-4" /> {preview.button}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * The order notices a store sends, each with its switch, the review of its
 * template and the message as the customer reads it.
 */
export function NoticeList({
  notices,
  disabled,
  onToggle,
}: {
  notices: WhatsAppNotice[];
  disabled: boolean;
  onToggle: (notice: WhatsAppNotice, on: boolean) => void;
}) {
  return (
    <ol className="divide-y rounded-2xl border">
      {notices.map((notice, index) => (
        <li key={notice.kind} className={cn("p-3", (disabled || !notice.enabled) && "bg-muted/30")}>
          <Collapsible>
            <div className="flex items-start gap-3">
              <span
                className={cn(
                  "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                  notice.enabled && !disabled ? "bg-whatsapp/15 text-whatsapp" : "bg-muted text-muted-foreground"
                )}
                aria-hidden
              >
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {notice.label} <TemplateStatus template={notice.template} />
                </p>
                <p className="text-xs text-muted-foreground">{notice.when}</p>
                {notice.template.reason && (
                  <p className="text-xs text-destructive">{notice.template.reason}</p>
                )}
                {notice.template.category === "MARKETING" && (
                  <p className="text-xs text-warning">A Meta classificou como marketing (custa mais).</p>
                )}
                <CollapsibleTrigger className="group mt-1 inline-flex items-center gap-1 rounded text-xs font-medium text-primary outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                  Ver mensagem
                  <ChevronDown className="size-3.5 transition-transform group-data-[panel-open]:rotate-180" />
                </CollapsibleTrigger>
              </div>
              <Switch
                checked={notice.enabled}
                disabled={disabled}
                aria-label={`Enviar "${notice.label}"`}
                onCheckedChange={(checked) => onToggle(notice, checked)}
              />
            </div>
            <CollapsibleContent className="mt-3 pl-9">
              <MessagePreview preview={notice.preview} />
            </CollapsibleContent>
          </Collapsible>
        </li>
      ))}
    </ol>
  );
}
