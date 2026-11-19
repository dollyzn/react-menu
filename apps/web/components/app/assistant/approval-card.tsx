"use client";

import { ArrowRight, Check, ShieldQuestion, X } from "lucide-react";
import type { AssistantApprovalPreview } from "@react-menu/contracts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemFooter,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatCurrencyBRL } from "@/utils/string";
import { formatQuantity } from "@/utils/units";

const STOCK_TYPE = { purchase: "Compra", waste: "Perda", adjustment: "Contagem" } as const;

function titleOf(preview: AssistantApprovalPreview) {
  switch (preview.kind) {
    case "update_items":
      return preview.rows.length === 1 ? `Alterar ${preview.rows[0].name}` : `Alterar ${preview.rows.length} itens`;
    case "record_stock":
      return `${STOCK_TYPE[preview.type]} de ${preview.name}`;
    case "create_menu_items": {
      const items = preview.categories.reduce((sum, category) => sum + category.items.length, 0);
      return `Criar ${items} ${items === 1 ? "item" : "itens"} no cardápio`;
    }
    case "store_status":
      return preview.status === "open" ? "Abrir a loja" : preview.status === "closed" ? "Fechar a loja" : "Colocar a loja em manutenção";
    case "pickup_time":
      return `Tempo de retirada: ${preview.after} min`;
    case "cancel_order":
      return `Cancelar o pedido #${preview.number} (${preview.customerName})`;
    case "item_details":
      return `Alterar ${preview.before.name}`;
  }
}

function descriptionOf(preview: AssistantApprovalPreview) {
  switch (preview.kind) {
    case "update_items":
      return `${preview.summary}. O cardápio online e o PDV mudam na hora.`;
    case "record_stock":
      return preview.note ?? "Entra no histórico do insumo.";
    case "create_menu_items":
      return "Os itens entram pausados e sem foto: revise e ative em Itens.";
    case "store_status":
      if (preview.status === "open") return "Volta a receber pedidos online" + (preview.scheduleEnabled ? ", seguindo o horário de funcionamento." : ".");
      return preview.scheduleEnabled
        ? "Para os pedidos online até o fim do horário de hoje; depois volta a seguir o horário. O PDV continua."
        : "Para os pedidos online até alguém abrir de novo. O PDV continua.";
    case "pickup_time":
      return "É o tempo que o cardápio mostra aos clientes e que marca um pedido como atrasado.";
    case "cancel_order":
      return preview.amountPaid > 0
        ? `Já foram pagos ${formatCurrencyBRL(preview.amountPaid)}: o que entrou online ou na maquininha volta sozinho; dinheiro do balcão se devolve à mão.`
        : "O estoque dos itens volta. Não dá para desfazer.";
    case "item_details":
      return "Muda no cardápio online e no PDV.";
  }
}

function PriceChange({ before, after }: { before: number; after: number }) {
  if (before === after) return <span className="tabular-nums">{formatCurrencyBRL(after)}</span>;
  return (
    <span className="inline-flex items-center gap-1 tabular-nums">
      <span className="text-muted-foreground line-through">{formatCurrencyBRL(before)}</span>
      <ArrowRight className="size-3 text-muted-foreground" />
      <span className="font-medium">{formatCurrencyBRL(after)}</span>
    </span>
  );
}

function SaleChange({ before, after }: { before: boolean; after: boolean }) {
  const badge = (on: boolean) =>
    on ? (
      <Badge variant="outline" className="text-success">
        À venda
      </Badge>
    ) : (
      <Badge variant="secondary">Pausado</Badge>
    );
  if (before === after) return badge(after);
  return (
    <span className="inline-flex items-center gap-1">
      {badge(before)}
      <ArrowRight className="size-3 text-muted-foreground" />
      {badge(after)}
    </span>
  );
}

/** What will change, read by the API from the database (before → after). */
function PreviewBody({ preview }: { preview: AssistantApprovalPreview }) {
  switch (preview.kind) {
    case "update_items":
      return (
        <Table className="text-xs">
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Preço</TableHead>
              <TableHead>Venda</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {preview.rows.map((row) => (
              <TableRow key={row.itemId}>
                <TableCell className="max-w-36 truncate font-medium">{row.name}</TableCell>
                <TableCell>
                  <PriceChange before={row.before.price} after={row.after.price} />
                </TableCell>
                <TableCell>
                  <SaleChange before={row.before.isAvailable} after={row.after.isAvailable} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      );
    case "record_stock":
      return (
        <div className="flex items-center gap-2 text-sm tabular-nums">
          <span className="text-muted-foreground">{formatQuantity(preview.before, preview.unit)}</span>
          <ArrowRight className="size-3.5 text-muted-foreground" />
          <span className="font-medium">{formatQuantity(preview.after, preview.unit)}</span>
          <span className="text-xs text-muted-foreground">
            ({preview.type === "adjustment" ? "contado" : `${preview.type === "waste" ? "−" : "+"}${formatQuantity(preview.quantity, preview.unit)}`})
          </span>
        </div>
      );
    case "store_status":
    case "pickup_time":
      return null;
    case "cancel_order":
      return (
        <div className="flex justify-between gap-3 text-xs">
          <span className="min-w-0">{preview.items}</span>
          <span className="shrink-0 font-medium tabular-nums">{formatCurrencyBRL(preview.total)}</span>
        </div>
      );
    case "item_details":
      return (
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-xs">
          {preview.before.name !== preview.after.name && (
            <>
              <dt className="text-muted-foreground">Nome</dt>
              <dd>
                <span className="text-muted-foreground line-through">{preview.before.name}</span> → {preview.after.name}
              </dd>
            </>
          )}
          {preview.before.description !== preview.after.description && (
            <>
              <dt className="text-muted-foreground">Descrição</dt>
              <dd className="flex flex-col gap-0.5">
                {preview.before.description && <span className="text-muted-foreground line-through">{preview.before.description}</span>}
                <span>{preview.after.description ?? "(sem descrição)"}</span>
              </dd>
            </>
          )}
        </dl>
      );
    case "create_menu_items":
      return (
        <div className="flex flex-col gap-3">
          {preview.categories.map((category) => (
            <div key={category.name} className="flex flex-col gap-1">
              <p className="flex items-center gap-2 text-xs font-medium">
                {category.name}
                {category.isNew && <Badge variant="secondary">Nova categoria</Badge>}
              </p>
              <ul className="flex flex-col gap-0.5 text-xs">
                {category.items.map((item) => (
                  <li key={item.name} className="flex justify-between gap-3">
                    <span className="min-w-0 truncate">
                      {item.name}
                      {item.description && <span className="text-muted-foreground"> · {item.description}</span>}
                    </span>
                    <span className="shrink-0 tabular-nums">{formatCurrencyBRL(item.price)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      );
  }
}

type State = "waiting" | "approved" | "denied";

/**
 * A write waiting for the person (the Confirmation pattern): what the
 * assistant wants to do and what will change, with Recusar / Aprovar. Once
 * answered it stays as a quiet record of the decision.
 */
export function ApprovalCard({
  preview,
  state,
  onAnswer,
  disabled,
}: {
  preview: AssistantApprovalPreview;
  state: State;
  onAnswer?: (approved: boolean) => void;
  disabled?: boolean;
}) {
  const waiting = state === "waiting";
  return (
    <Item
      variant="outline"
      size="sm"
      className={cn("items-start", waiting ? "border-warning/40 bg-warning/5" : "bg-muted/30")}
    >
      <ItemMedia variant="icon" className={cn(waiting ? "text-warning" : state === "approved" ? "text-success" : "text-muted-foreground")}>
        {waiting ? <ShieldQuestion /> : state === "approved" ? <Check /> : <X />}
      </ItemMedia>
      <ItemContent className="min-w-0">
        <ItemTitle>{titleOf(preview)}</ItemTitle>
        <ItemDescription className="line-clamp-none">
          {waiting ? descriptionOf(preview) : state === "approved" ? "Aprovado por você." : "Recusado: nada foi alterado."}
        </ItemDescription>
      </ItemContent>
      {waiting && (
        <ItemFooter className="flex-col items-stretch gap-3">
          {!["store_status", "pickup_time"].includes(preview.kind) && (
            <div className="min-w-0 overflow-x-auto rounded-lg border bg-background p-2">
              <PreviewBody preview={preview} />
            </div>
          )}
          <ItemActions className="justify-end">
            <Button size="sm" variant="outline" disabled={disabled} onClick={() => onAnswer?.(false)}>
              Recusar
            </Button>
            <Button size="sm" disabled={disabled} onClick={() => onAnswer?.(true)}>
              <Check data-icon="inline-start" />
              Aprovar
            </Button>
          </ItemActions>
        </ItemFooter>
      )}
    </Item>
  );
}
