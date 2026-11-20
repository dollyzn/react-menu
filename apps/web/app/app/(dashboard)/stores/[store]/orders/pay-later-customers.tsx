"use client";

import { useState } from "react";
import { format, formatDistanceToNowStrict, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Banknote, ChevronLeft, ChevronRight, MessageCircle, Phone } from "lucide-react";
import { toast } from "sonner";
import type { PayLaterCustomer, PayLaterCustomerSort, PayLaterOrder } from "@react-menu/contracts";
import { SearchInput } from "@/components/app/search-input";
import { ReceivePaymentDialog } from "@/components/app/payments/receive-payment-dialog";
import { paidWith } from "@/components/app/payments/counter-methods";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import useDebouncedEffect from "@/hooks/use-debonced-effect";
import { useLastValue } from "@/hooks/use-last-value";
import { lineName } from "@/lib/order-line";
import { cn } from "@/lib/utils";
import { useAppSelector } from "@/redux/hooks";
import { useGetPayLaterCustomersQuery, useReceivePayLaterMutation } from "@/redux/features/order/orderApi";
import { getErrorMessage } from "@/utils/get-error-message";
import { formatCurrencyBRL, formatPhoneBR } from "@/utils/string";
import { ReceivePayment } from "./receive-payment";

const PER_PAGE = 12;
/** Orders shown per customer before "Ver mais". */
const FIRST_ORDERS = 4;

const SORTS: { value: PayLaterCustomerSort; label: string }[] = [
  { value: "due:desc", label: "Maior valor" },
  { value: "since:asc", label: "Há mais tempo" },
  { value: "name:asc", label: "Nome (A–Z)" },
];

const itemsSummary = (order: PayLaterOrder) => order.items.map((line) => `${line.quantity}× ${lineName(line)}`).join(", ");
const when = (iso: string) => format(parseISO(iso), "EEE, dd/MM 'às' HH:mm", { locale: ptBR });
const linkPhone = (phone: string | null) => phone?.replace(/\D/g, "").replace(/^(?!55)/, "55") ?? null;
const initials = (name: string) =>
  name
    .replace(/\(.*?\)/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join("");

/** What the counter sends on WhatsApp to charge: the total and the orders. */
function chargeMessage(customer: PayLaterCustomer, storeName: string | undefined) {
  const first = customer.name.split(/\s+/)[0];
  const orders = customer.orders.map((order) => `#${order.number} (${format(parseISO(order.createdAt), "dd/MM")})`).join(", ");
  return (
    `Olá, ${first}! ${storeName ? `Aqui é da ${storeName}. ` : ""}` +
    `Ficou em aberto ${formatCurrencyBRL(customer.due)} ${customer.orders.length === 1 ? "do pedido" : "dos pedidos"} ${orders}. ` +
    "Quando puder, é só acertar com a gente. Obrigado!"
  );
}

/** What a receipt is for: one order, or several of one customer. */
type Receiving = { customer: PayLaterCustomer; orders: PayLaterOrder[] };

/**
 * "Pagar depois" by customer: each one with what they owe, since when and
 * their orders, to receive all of them, or the ones ticked, in one go.
 */
export function PayLaterCustomers({ storeId }: { storeId: string }) {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<PayLaterCustomerSort>("due:desc");
  const [page, setPage] = useState(1);
  useDebouncedEffect(
    () => {
      setQuery(search.trim());
      setPage(1);
    },
    [search],
    300
  );
  const { data, isLoading, isFetching, isError, refetch } = useGetPayLaterCustomersQuery({
    storeId,
    search: query || undefined,
    sort,
    page,
    perPage: PER_PAGE,
  });
  const storeName = useAppSelector((state) => state.auth.user?.stores.find((store) => store.id === storeId)?.name);
  const [receiving, setReceiving] = useState<Receiving | null>(null);
  const shown = useLastValue(receiving);
  const customers = data?.data ?? [];
  const total = data?.meta.total ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <section aria-label="Clientes com pedidos para pagar depois" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          value={search}
          onValueChange={setSearch}
          placeholder="Cliente, telefone ou número"
          aria-label="Buscar cliente, telefone ou número do pedido"
          wrapperClassName="w-full min-w-0 sm:w-auto sm:max-w-xs sm:flex-1"
        />
        <Select
          items={SORTS}
          value={sort}
          onValueChange={(next) => {
            if (!next) return;
            setSort(next as PayLaterCustomerSort);
            setPage(1);
          }}
        >
          <SelectTrigger aria-label="Ordenar clientes" className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORTS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="ml-auto text-sm text-muted-foreground tabular-nums" aria-live="polite">
          {isLoading ? "" : `${total} ${total === 1 ? "cliente" : "clientes"}`}
        </p>
      </div>

      {isError && !data ? (
        <div role="alert" className="flex flex-col items-center gap-3 rounded-2xl border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">Não foi possível carregar os clientes.</p>
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            Tentar de novo
          </Button>
        </div>
      ) : isLoading ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-56 rounded-2xl" />
          ))}
        </div>
      ) : customers.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          Ninguém encontrado com “{query}”.
        </p>
      ) : (
        <div className={cn("grid items-start gap-3 lg:grid-cols-2", isFetching && "opacity-70 transition-opacity")}>
          {customers.map((customer) => (
            <CustomerCard
              // A new list of orders (one paid) starts with nothing ticked.
              key={`${customer.key}:${customer.orders.map((order) => order.id).join(",")}`}
              customer={customer}
              storeName={storeName}
              onReceive={(orders) => setReceiving({ customer, orders })}
            />
          ))}
        </div>
      )}

      {lastPage > 1 && (
        <nav aria-label="Páginas de clientes" className="flex items-center justify-end gap-2 text-sm">
          <span className="text-muted-foreground tabular-nums">
            {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, total)} de {total}
          </span>
          <Button variant="outline" size="icon-sm" aria-label="Página anterior" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Próxima página"
            disabled={page >= lastPage}
            onClick={() => setPage(page + 1)}
          >
            <ChevronRight />
          </Button>
        </nav>
      )}

      {shown && shown.orders.length === 1 && (
        <ReceivePayment
          order={shown.orders[0]}
          storeId={storeId}
          open={receiving !== null}
          onClose={() => setReceiving(null)}
        />
      )}
      {shown && shown.orders.length > 1 && (
        <ReceiveSeveral storeId={storeId} receiving={shown} open={receiving !== null} onClose={() => setReceiving(null)} />
      )}
    </section>
  );
}

/** One customer: who, how much and since when; their orders to tick; "Receber". */
function CustomerCard({
  customer,
  storeName,
  onReceive,
}: {
  customer: PayLaterCustomer;
  storeName: string | undefined;
  onReceive: (orders: PayLaterOrder[]) => void;
}) {
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const [all, setAll] = useState(false);
  const many = customer.orders.length > 1;
  const visible = all ? customer.orders : customer.orders.slice(0, FIRST_ORDERS);
  const chosen = customer.orders.filter((order) => picked.has(order.id));
  const chosenDue = chosen.reduce((sum, order) => sum + order.amountDue, 0);
  const phone = linkPhone(customer.phone);
  const icon = buttonVariants({ variant: "outline", size: "icon" });
  const toggle = (id: string, on: boolean) =>
    setPicked((current) => {
      const next = new Set(current);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  const allPicked = chosen.length === customer.orders.length;

  return (
    <article
      aria-label={`${customer.name}: ${formatCurrencyBRL(customer.due)} em aberto`}
      className="flex flex-col overflow-hidden rounded-2xl border bg-card shadow-xs"
    >
      <header className="flex items-start gap-3 p-4">
        <span
          aria-hidden
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary"
        >
          {initials(customer.name) || "?"}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base leading-tight font-bold">{customer.name}</p>
          {customer.phone && <p className="text-sm text-muted-foreground tabular-nums">{formatPhoneBR(customer.phone)}</p>}
          <p className="mt-0.5 text-xs text-muted-foreground">
            {customer.orders.length} {customer.orders.length === 1 ? "pedido" : "pedidos"} ·{" "}
            {customer.orders.length === 1 ? "há" : "o mais antigo há"}{" "}
            {formatDistanceToNowStrict(parseISO(customer.since), { locale: ptBR })}
          </p>
        </div>
        <p className="shrink-0 text-right text-xl leading-tight font-black text-primary tabular-nums">
          {formatCurrencyBRL(customer.due)}
        </p>
      </header>

      {many && (
        <div className="flex items-center justify-between gap-2 border-t bg-muted/30 px-4 py-2">
          <label className="flex cursor-pointer items-center gap-3 text-sm font-medium">
            <Checkbox
              checked={allPicked}
              indeterminate={chosen.length > 0 && !allPicked}
              onCheckedChange={(on) => setPicked(on ? new Set(customer.orders.map((order) => order.id)) : new Set())}
            />
            Selecionar todos
          </label>
          {chosen.length > 0 && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {chosen.length} de {customer.orders.length}
            </span>
          )}
        </div>
      )}

      <ul aria-label={`Pedidos de ${customer.name}`} className="flex flex-col divide-y border-t">
        {visible.map((order) => {
          const row = (
            <>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">
                  #{order.number} <span className="font-normal text-muted-foreground">· {when(order.createdAt)}</span>
                </span>
                <span className="line-clamp-1 text-xs text-muted-foreground">{itemsSummary(order)}</span>
                {order.payLaterBy?.name && (
                  <span className="block text-xs text-muted-foreground/80">
                    {order.status === "completed" ? "Entregue" : "Ainda no quadro"} · por {order.payLaterBy.name}
                  </span>
                )}
              </span>
              <span className="shrink-0 text-right">
                <span className="block text-sm font-semibold tabular-nums">{formatCurrencyBRL(order.amountDue)}</span>
                {order.amountPaid > 0 && (
                  <span className="block text-xs text-muted-foreground">já pagou {formatCurrencyBRL(order.amountPaid)}</span>
                )}
              </span>
            </>
          );
          return (
            <li key={order.id}>
              {many ? (
                <label
                  className={cn(
                    "flex min-h-14 cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/40",
                    picked.has(order.id) && "bg-primary/5"
                  )}
                >
                  <Checkbox
                    checked={picked.has(order.id)}
                    onCheckedChange={(on) => toggle(order.id, on)}
                    aria-label={`Pedido #${order.number}, ${formatCurrencyBRL(order.amountDue)}`}
                  />
                  {row}
                </label>
              ) : (
                <div className="flex min-h-14 items-center gap-3 px-4 py-2.5">{row}</div>
              )}
            </li>
          );
        })}
      </ul>
      {customer.orders.length > FIRST_ORDERS && (
        <Button variant="ghost" size="sm" className="mx-4 my-1 self-start" onClick={() => setAll((value) => !value)}>
          {all
            ? "Mostrar menos"
            : `Ver mais ${customer.orders.length - FIRST_ORDERS} ${customer.orders.length - FIRST_ORDERS === 1 ? "pedido" : "pedidos"}`}
        </Button>
      )}

      <footer className="mt-auto flex flex-wrap items-center gap-2 border-t p-3">
        {phone && (
          <>
            <a href={`tel:+${phone}`} aria-label={`Ligar para ${customer.name}`} className={icon}>
              <Phone />
            </a>
            <a
              href={`https://wa.me/${phone}?text=${encodeURIComponent(chargeMessage(customer, storeName))}`}
              target="_blank"
              rel="noreferrer"
              aria-label={`Cobrar ${customer.name} no WhatsApp`}
              className={icon}
            >
              <MessageCircle />
            </a>
          </>
        )}
        <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-2 sm:flex-none">
          {chosen.length > 0 && !allPicked && (
            <Button variant="ghost" size="sm" onClick={() => setPicked(new Set())}>
              Limpar
            </Button>
          )}
          <Button
            className="min-w-0 flex-1 sm:flex-none"
            onClick={() => onReceive(chosen.length > 0 ? chosen : customer.orders)}
          >
            <Banknote data-icon="inline-start" />
            <span className="truncate">
              {chosen.length > 0 && !allPicked
                ? `Receber ${chosen.length} · ${formatCurrencyBRL(chosenDue)}`
                : many
                  ? `Receber tudo · ${formatCurrencyBRL(customer.due)}`
                  : `Receber · ${formatCurrencyBRL(customer.due)}`}
            </span>
          </Button>
        </div>
      </footer>
    </article>
  );
}

/** Several orders of one customer: one amount, one way of paying, one receipt per order. */
function ReceiveSeveral({
  storeId,
  receiving,
  open,
  onClose,
}: {
  storeId: string;
  receiving: Receiving;
  open: boolean;
  onClose: () => void;
}) {
  const [receive, { isLoading }] = useReceivePayLaterMutation();
  const [error, setError] = useState<string | null>(null);
  const { customer, orders } = receiving;
  const amount = Math.round(orders.reduce((sum, order) => sum + order.amountDue, 0) * 100) / 100;
  return (
    <ReceivePaymentDialog
      open={open}
      onClose={() => {
        setError(null);
        onClose();
      }}
      title={`Receber ${orders.length} pedidos de ${customer.name}`}
      badge={`${customer.name} · ${orders.map((order) => `#${order.number}`).join(", ")}`}
      total={amount}
      // The card machine charges one order at a time.
      canCharge={false}
      busy={isLoading}
      error={error}
      onConfirm={async (method) => {
        if (method === "machine") return;
        setError(null);
        try {
          await receive({ storeId, orderIds: orders.map((order) => order.id), method, amount }).unwrap();
          toast.success(`${customer.name}: ${formatCurrencyBRL(amount)} recebidos ${paidWith(method)} (${orders.length} pedidos)`);
          onClose();
        } catch (err) {
          setError(getErrorMessage(err as { data?: { error?: string } }, "Não foi possível registrar o pagamento."));
        }
      }}
    >
      <Badge variant="secondary" className="self-center">
        Cada pedido fica pago com o valor dele
      </Badge>
    </ReceivePaymentDialog>
  );
}
