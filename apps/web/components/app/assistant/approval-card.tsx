"use client";

import { ArrowRight, Check, ChevronRight, ShieldQuestion, TriangleAlert, X } from "lucide-react";
import type { AssistantApprovalPreview } from "@react-menu/contracts";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
import { groupRule } from "@/lib/group-rule";
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
    case "option_group":
      return `Alterar o grupo "${preview.before.name}"`;
    case "new_option_group":
      return `Criar o grupo "${preview.group.name}"`;
    case "item_extras":
      return preview.rows.length === 1
        ? `Mudar os grupos e adicionais de ${preview.rows[0].name}`
        : `Mudar os grupos e adicionais de ${preview.rows.length} itens`;
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
    case "option_group": {
      const { count, names } = preview.items;
      if (count === 0) return "Nenhum item usa este grupo agora.";
      const list = names.slice(0, 3).join(", ") + (count > 3 ? ` e mais ${count - 3}` : "");
      return count === 1 ? `Muda no único item que o usa: ${list}.` : `Muda nos ${count} itens que o usam: ${list}.`;
    }
    case "new_option_group": {
      const base = preview.copyOf ? `Uma cópia de "${preview.copyOf}" com a regra abaixo.` : "Um grupo de escolha novo.";
      if (preview.items.length === 0) return `${base} Ainda sem itens.`;
      const where = `${preview.items.length} ${preview.items.length === 1 ? "item" : "itens"}`;
      return preview.replaces
        ? `${base} Entra no lugar de "${preview.replaces}" em ${where}; os outros itens continuam como estão.`
        : `${base} Entra em ${where}.`;
    }
    case "item_extras":
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

/** A list before → after: what stays, what comes in (+) and what leaves (struck through). */
function ListChange({ before, after, empty }: { before: string[]; after: string[]; empty: string }) {
  const removed = before.filter((name) => !after.includes(name));
  if (after.length === 0 && removed.length === 0) return <span className="text-muted-foreground">{empty}</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {after.map((name) =>
        before.includes(name) ? (
          <Badge key={name} variant="outline">
            {name}
          </Badge>
        ) : (
          <Badge key={name} variant="outline" className="border-success/40 text-success">
            + {name}
          </Badge>
        )
      )}
      {removed.map((name) => (
        <Badge key={name} variant="outline" className="text-muted-foreground line-through">
          {name}
        </Badge>
      ))}
    </span>
  );
}

const optionLabel = (option: { name: string; price: number }) =>
  option.price > 0 ? `${option.name} (${formatCurrencyBRL(option.price)})` : option.name;

type NewCategory = Extract<AssistantApprovalPreview, { kind: "create_menu_items" }>["categories"][number];

/**
 * New items by category: each category folds (a menu photo easily brings
 * 30 items); only the first opens by itself. Name and price on one line,
 * the description under it, never wider than the sheet.
 */
function NewItemsPreview({ categories }: { categories: NewCategory[] }) {
  const items = categories.reduce((sum, category) => sum + category.items.length, 0);
  const created = categories.filter((category) => category.isNew).length;
  return (
    <div className="flex flex-col">
      <p className="border-b px-3 py-2 text-xs text-muted-foreground">
        {items} {items === 1 ? "item" : "itens"} em {categories.length} {categories.length === 1 ? "categoria" : "categorias"}
        {created > 0 && ` (${created} ${created === 1 ? "nova" : "novas"})`}
      </p>
      {categories.map((category, index) => (
        <Collapsible key={category.name} defaultOpen={index === 0} className="border-b last:border-b-0">
          <CollapsibleTrigger className="group/cat flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium outline-none hover:bg-muted/50 focus-visible:bg-muted/50">
            <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[panel-open]/cat:rotate-90" />
            <span className="min-w-0 flex-1 truncate">{category.name}</span>
            {category.isNew && <Badge variant="secondary">Nova</Badge>}
            <span className="shrink-0 text-xs font-normal text-muted-foreground tabular-nums">
              {category.items.length} {category.items.length === 1 ? "item" : "itens"}
            </span>
          </CollapsibleTrigger>
          {/* Opens and closes by height (Base UI measures it), like the Trace's steps. */}
          <CollapsibleContent className="h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-200 ease-out motion-reduce:transition-none data-ending-style:h-0 data-starting-style:h-0">
            <ul className="flex flex-col divide-y border-t bg-muted/20">
              {category.items.map((item) => (
                <li key={item.name} className="flex flex-col gap-0.5 px-3 py-2 pl-9">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 text-sm font-medium break-words">{item.name}</span>
                    <span className="shrink-0 text-sm tabular-nums">{formatCurrencyBRL(item.price)}</span>
                  </span>
                  {item.description && <span className="line-clamp-2 text-xs text-muted-foreground">{item.description}</span>}
                </li>
              ))}
            </ul>
          </CollapsibleContent>
        </Collapsible>
      ))}
    </div>
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
      return <NewItemsPreview categories={preview.categories} />;
    case "option_group":
      return (
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-3 gap-y-2 text-xs">
          {preview.before.name !== preview.after.name && (
            <>
              <dt className="text-muted-foreground">Nome</dt>
              <dd>
                <span className="text-muted-foreground line-through">{preview.before.name}</span> → {preview.after.name}
              </dd>
            </>
          )}
          <dt className="text-muted-foreground">Regra</dt>
          <dd>
            {groupRule(preview.before) === groupRule(preview.after) ? (
              groupRule(preview.after)
            ) : (
              <span className="flex flex-wrap items-center gap-1">
                <span className="text-muted-foreground line-through">{groupRule(preview.before)}</span>
                <ArrowRight className="size-3 text-muted-foreground" />
                <span className="font-medium">{groupRule(preview.after)}</span>
              </span>
            )}
          </dd>
          <dt className="text-muted-foreground">Opções</dt>
          <dd>
            <ListChange before={preview.before.options.map(optionLabel)} after={preview.after.options.map(optionLabel)} empty="Nenhuma" />
          </dd>
        </dl>
      );
    case "new_option_group":
      return (
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-3 gap-y-2 text-xs">
          <dt className="text-muted-foreground">Regra</dt>
          <dd className="font-medium">{groupRule(preview.group)}</dd>
          <dt className="text-muted-foreground">Opções</dt>
          <dd>
            <ListChange before={preview.group.options.map(optionLabel)} after={preview.group.options.map(optionLabel)} empty="Nenhuma" />
          </dd>
          {preview.items.length > 0 && (
            <>
              <dt className="text-muted-foreground">Itens</dt>
              <dd>{preview.items.join(", ")}</dd>
            </>
          )}
        </dl>
      );
    case "item_extras":
      return (
        <ul className="flex flex-col divide-y text-xs">
          {preview.rows.map((row) => (
            <li key={row.name} className="flex flex-col gap-1.5 py-2 first:pt-0 last:pb-0">
              <span className="font-medium">{row.name}</span>
              <span className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-3 gap-y-1">
                <span className="text-muted-foreground">Grupos</span>
                <ListChange before={row.groups.before} after={row.groups.after} empty="Nenhum" />
                {(row.addons.before.length > 0 || row.addons.after.length > 0) && (
                  <>
                    <span className="text-muted-foreground">Adicionais</span>
                    <ListChange before={row.addons.before} after={row.addons.after} empty="Nenhum" />
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
      );
  }
}

/**
 * waiting: the last reply asks; skipped: left unanswered and declined by a
 * newer message; failed: approved, but the change didn't go through.
 */
type State = "waiting" | "approved" | "denied" | "skipped" | "failed";

const ANSWERED: Record<Exclude<State, "waiting">, string> = {
  approved: "Aprovado por você.",
  denied: "Recusado: nada foi alterado.",
  skipped: "Ficou sem resposta: nada foi alterado.",
  failed: "Aprovado, mas não deu certo.",
};

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
  error,
}: {
  preview: AssistantApprovalPreview;
  state: State;
  /** Why an approved change failed. */
  error?: string;
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
      <ItemMedia
        variant="icon"
        className={cn(
          waiting ? "text-warning" : state === "approved" ? "text-success" : state === "failed" ? "text-destructive" : "text-muted-foreground"
        )}
      >
        {waiting ? <ShieldQuestion /> : state === "approved" ? <Check /> : state === "failed" ? <TriangleAlert /> : <X />}
      </ItemMedia>
      <ItemContent className="min-w-0">
        <ItemTitle>{titleOf(preview)}</ItemTitle>
        <ItemDescription className="line-clamp-none">
          {waiting ? descriptionOf(preview) : ANSWERED[state]}
          {state === "failed" && error && <span className="block text-destructive">{error}</span>}
        </ItemDescription>
      </ItemContent>
      {waiting && (
        <ItemFooter className="min-w-0 flex-col items-stretch gap-3">
          {!["store_status", "pickup_time"].includes(preview.kind) && (
            <div
              className={cn(
                "min-w-0 rounded-lg border bg-background",
                // Its own layout fits the width; tables may scroll sideways.
                preview.kind === "create_menu_items" ? "overflow-hidden" : "overflow-x-auto p-2"
              )}
            >
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
