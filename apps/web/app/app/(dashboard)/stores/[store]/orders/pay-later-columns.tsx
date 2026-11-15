"use client";

import { createContext, useContext } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Banknote, MessageCircle, Phone } from "lucide-react";
import type { PayLaterOrder } from "@react-menu/contracts";
import type { ColumnDef, HeaderContext, Row } from "@/components/app/data-table/features";
import type { ColumnsConfig } from "@/components/data-table";
import { DataTableColumnHeader } from "@/components/app/data-table/data-table-column-header";
import DataTableColumnCell from "@/components/app/data-table/data-table-column-cell";
import { cellButtonSize } from "@/components/app/data-table/density";
import { Button, buttonVariants } from "@/components/ui/button";
import { lineName } from "@/lib/order-line";
import { formatCurrencyBRL, formatPhoneBR } from "@/utils/string";

/** What the page does for a row ("Receber" opens its dialog); columns and cards stay static. */
export const PayLaterActionsContext = createContext<{ receive: (order: PayLaterOrder) => void } | null>(null);

function usePayLaterActions() {
  const actions = useContext(PayLaterActionsContext);
  if (!actions) throw new Error("PayLaterActionsContext missing");
  return actions;
}

/** The phone as the staff read it ("(13) 99999-0000"), and its digits for links. */
const shownPhone = (order: PayLaterOrder) => (order.customerPhone ? formatPhoneBR(order.customerPhone) : null);
const linkPhone = (order: PayLaterOrder) => order.customerPhone?.replace(/\D/g, "").replace(/^(?!55)/, "55") ?? null;
const itemsSummary = (order: PayLaterOrder) => order.items.map((line) => `${line.quantity}× ${lineName(line)}`).join(", ");
const when = (order: PayLaterOrder) => format(parseISO(order.createdAt), "EEE, dd/MM 'às' HH:mm", { locale: ptBR });

type CellSize = "xs" | "sm" | "default" | "lg";
/** The icon links match the "Receber" button beside them. */
const ICON_SIZE = { xs: "icon-xs", sm: "icon-sm", default: "icon", lg: "icon-lg" } as const;

/** Ligar / WhatsApp (when there is a phone) and "Receber". */
function PayLaterRowActions({ order, size = "sm" }: { order: PayLaterOrder; size?: CellSize }) {
  const { receive } = usePayLaterActions();
  const phone = linkPhone(order);
  const icon = buttonVariants({ variant: "ghost", size: ICON_SIZE[size] });
  return (
    <div className="flex items-center justify-end gap-1">
      {phone && (
        <>
          <a href={`tel:+${phone}`} aria-label={`Ligar para ${order.customerName}`} className={icon}>
            <Phone />
          </a>
          <a
            href={`https://wa.me/${phone}`}
            target="_blank"
            rel="noreferrer"
            aria-label={`WhatsApp de ${order.customerName}`}
            className={icon}
          >
            <MessageCircle />
          </a>
        </>
      )}
      <Button size={size} variant="outline" aria-label={`Receber o pedido #${order.number}`} onClick={() => receive(order)}>
        <Banknote /> Receber
      </Button>
    </div>
  );
}

const header =
  (title: string) =>
  // eslint-disable-next-line react/display-name
  ({ column }: HeaderContext<PayLaterOrder, unknown>) => <DataTableColumnHeader column={column} title={title} />;

export const payLaterColumns: ColumnDef<PayLaterOrder>[] = [
  {
    id: "number",
    accessorKey: "number",
    header: header("Pedido"),
    enableSorting: false,
    cell: ({ row }) => (
      <DataTableColumnCell>
        <span className="font-black tabular-nums">#{row.original.number}</span>
      </DataTableColumnCell>
    ),
    meta: { name: "Pedido" },
  },
  {
    id: "createdAt",
    accessorKey: "createdAt",
    header: header("Data"),
    cell: ({ row }) => (
      <DataTableColumnCell>
        <span className="whitespace-nowrap tabular-nums">{format(parseISO(row.original.createdAt), "dd/MM/yy HH:mm")}</span>
      </DataTableColumnCell>
    ),
    meta: { name: "Data" },
  },
  {
    // The API searches it by name, phone or order number.
    id: "customerName",
    accessorKey: "customerName",
    header: header("Cliente"),
    enableSorting: false,
    cell: ({ row }) => {
      const phone = shownPhone(row.original);
      return (
        <DataTableColumnCell>
          <span className="block font-medium">{row.original.customerName}</span>
          {phone && <span className="block text-xs text-muted-foreground tabular-nums">{phone}</span>}
        </DataTableColumnCell>
      );
    },
    meta: { name: "Cliente, telefone ou número" },
  },
  {
    id: "items",
    header: header("Itens"),
    enableSorting: false,
    cell: ({ row }) => (
      <DataTableColumnCell>
        <span className="block max-w-70 truncate text-muted-foreground">{itemsSummary(row.original)}</span>
      </DataTableColumnCell>
    ),
    meta: { name: "Itens" },
  },
  {
    id: "payLaterBy",
    accessorFn: (order) => order.payLaterBy?.name ?? "",
    header: header("Marcado por"),
    enableSorting: false,
    cell: ({ row }) => (
      <DataTableColumnCell>
        <span className="text-sm text-muted-foreground">{row.original.payLaterBy?.name ?? "—"}</span>
      </DataTableColumnCell>
    ),
    meta: { name: "Marcado por" },
  },
  {
    id: "amountDue",
    accessorKey: "amountDue",
    header: header("Em aberto"),
    cell: ({ row }) => (
      <DataTableColumnCell>
        <span className="font-semibold text-primary tabular-nums">{formatCurrencyBRL(row.original.amountDue)}</span>
        {row.original.amountPaid > 0 && (
          <span className="block text-xs text-muted-foreground">já pagou {formatCurrencyBRL(row.original.amountPaid)}</span>
        )}
      </DataTableColumnCell>
    ),
    meta: { name: "Em aberto" },
  },
  {
    id: "actions",
    enableSorting: false,
    enableHiding: false,
    header: () => <span className="sr-only">Ações</span>,
    cell: ({ row, table }) => (
      <DataTableColumnCell>
        <PayLaterRowActions order={row.original} size={cellButtonSize(table.options.meta?.density)} />
      </DataTableColumnCell>
    ),
    meta: { name: "Ações" },
  },
];

export const payLaterColumnsConfig: ColumnsConfig[] = [{ key: "customerName", searchable: true }];

/** The card (default view): who owes, how much, since when, and "Receber". */
export function renderPayLaterCard(row: Row<PayLaterOrder>) {
  const order = row.original;
  const phone = shownPhone(order);
  return (
    <article
      aria-label={`Pedido ${order.number} de ${order.customerName}: ${formatCurrencyBRL(order.amountDue)} para pagar`}
      className="flex h-full flex-col gap-3 rounded-2xl border bg-card p-4 shadow-xs"
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-lg leading-tight font-bold">{order.customerName}</p>
          {phone && <p className="text-sm text-muted-foreground tabular-nums">{phone}</p>}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-lg leading-tight font-black text-primary tabular-nums">{formatCurrencyBRL(order.amountDue)}</p>
          {order.amountPaid > 0 && (
            <p className="text-xs text-muted-foreground">já pagou {formatCurrencyBRL(order.amountPaid)}</p>
          )}
        </div>
      </header>
      <div className="flex-1 rounded-xl bg-muted/50 px-3 py-2">
        <p className="text-sm font-semibold">
          #{order.number} · <span className="font-normal text-muted-foreground">{when(order)}</span>
        </p>
        <p className="line-clamp-2 text-xs text-muted-foreground">{itemsSummary(order)}</p>
      </div>
      <footer className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-xs text-muted-foreground">
          {order.status === "completed" ? "Entregue" : "Ainda no quadro"}
          {order.payLaterBy?.name ? ` · por ${order.payLaterBy.name}` : ""}
        </p>
        <PayLaterRowActions order={order} />
      </footer>
    </article>
  );
}
