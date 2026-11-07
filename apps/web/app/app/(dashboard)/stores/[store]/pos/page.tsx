"use client";

import { useMemo, useState } from "react";
import { Toggle } from "@base-ui/react/toggle";
import { ToggleGroup as ToggleGroupPrimitive } from "@base-ui/react/toggle-group";
import Image from "@/components/app/image";
import { useParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { CreditCard, Minus, Phone, Plus, ReceiptText, SearchX, Send, SlidersHorizontal, Trash2, UtensilsCrossed } from "lucide-react";
import type { PointCharge, PublicMenuItem } from "@react-menu/contracts";
import { ItemCustomizer, type CustomizedLine } from "@/app/(menu)/_components/item-detail";
import { AnimatedPrice } from "@/components/app/animated-price";
import { ResponsiveModal } from "@/components/app/responsive-modal";
import { SearchInput } from "@/components/app/search-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetPublicMenuQuery } from "@/redux/features/public/publicApi";
import { useCreatePosOrderMutation } from "@/redux/features/order/orderApi";
import { stockHint, unitsLeft } from "@/lib/stock";
import { useGetStoreByIdQuery } from "@/redux/features/store/storeApi";
import { formatCurrencyBRL, formatPhoneBR, normalizeSearch } from "@/utils/string";
import { getErrorMessage, isConnectionError } from "@/utils/get-error-message";
import { randomId, releaseIdempotencyKey, stableIdempotencyKey } from "@/lib/idempotency";
import { cn } from "@/lib/utils";
import { CustomerAutocomplete } from "./customer-autocomplete";
import { addonLabels } from "@/lib/addon-label";
import { lineAddonsInput } from "@/redux/slices/cart";
import { useLastValue } from "@/hooks/use-last-value";
import { PointChargeDialog } from "@/components/app/point/point-charge-dialog";
import { PendingChargesBar } from "@/components/app/point/pending-charges-bar";
import { useGetPointConfigQuery } from "@/redux/features/point/pointApi";

type TicketLine = CustomizedLine & { key: string };
const unitTotal = (line: CustomizedLine) =>
  line.unitPrice + line.addons.reduce((sum, addon) => sum + addon.price, 0);
const lineTotal = (line: CustomizedLine) => unitTotal(line) * line.quantity;

/** Point of sale: staff build an order fast and send it to the kitchen. */
export default function PosPage() {
  const { store: storeId } = useParams<{ store: string }>();
  const { data: store } = useGetStoreByIdQuery(storeId);
  const { data: menu, isLoading } = useGetPublicMenuQuery(
    { slug: store?.slug, preview: true },
    { skip: !store }
  );
  const [createOrder, { isLoading: sending }] = useCreatePosOrderMutation();

  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState<number | "all">("all");
  const [picking, setPicking] = useState<PublicMenuItem | null>(null);
  // The customizer stays on screen while its dialog animates closed.
  const pickingShown = useLastValue(picking);
  const [lines, setLines] = useState<TicketLine[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [ticketOpen, setTicketOpen] = useState(false);
  // Mercado Pago Point: a machine on lets the ticket be charged right after it is sent.
  const { data: point } = useGetPointConfigQuery(storeId);
  const canCharge = Boolean(point?.available && point.terminals.length > 0);
  const [charging, setCharging] = useState<{ id: string; number: number; total: number } | null>(null);
  /** A charge already on the machine, opened from the "Na maquininha" bar. */
  const [resuming, setResuming] = useState<PointCharge | null>(null);

  const categories = menu?.categories ?? [];
  const totalItems = categories.reduce((sum, category) => sum + category.items.length, 0);

  // Grouped by category, so "Tudo" reads as sections instead of one long grid.
  const groups = useMemo(() => {
    const term = normalizeSearch(query);
    return (menu?.categories ?? [])
      .map((category, index) => ({
        id: category.id,
        name: category.name,
        accent: CATEGORY_ACCENTS[index % CATEGORY_ACCENTS.length],
        items: category.items.filter(
          (item) => !term || normalizeSearch(`${item.name} ${item.description ?? ""}`).includes(term)
        ),
      }))
      .filter((group) => (categoryId === "all" || group.id === categoryId) && group.items.length > 0);
  }, [menu, query, categoryId]);
  const items = groups.flatMap((group) => group.items);

  const inTicket = useMemo(() => {
    const counts = new Map<string, number>();
    for (const line of lines) counts.set(line.itemId, (counts.get(line.itemId) ?? 0) + line.quantity);
    return counts;
  }, [lines]);

  /** Units the stock still allows for an item, after what the ticket holds (null = no limit). */
  const leftFor = (itemId: string) => {
    const item = categories.flatMap((category) => category.items).find((candidate) => candidate.id === itemId);
    return unitsLeft(item?.stockLeft ?? null, inTicket.get(itemId) ?? 0);
  };

  const total = lines.reduce((sum, line) => sum + lineTotal(line), 0);
  const count = lines.reduce((sum, line) => sum + line.quantity, 0);

  const quickAdd = (item: PublicMenuItem) => {
    if (item.addons.length > 0 || item.optionGroups.length > 0) return setPicking(item);
    addToTicket({
      itemId: item.id,
      name: item.name,
      photoUrl: item.photoUrl,
      unitPrice: item.price,
      addons: [],
      notes: "",
      quantity: 1,
    });
  };

  const addToTicket = (line: CustomizedLine) => {
    setLines((current) => {
      const same = current.find(
        (l) => l.itemId === line.itemId && !l.notes && !line.notes && l.addons.length === 0 && line.addons.length === 0
      );
      if (same) return current.map((l) => (l === same ? { ...l, quantity: l.quantity + line.quantity } : l));
      return [...current, { ...line, key: randomId() }];
    });
  };

  const changeQuantity = (key: string, delta: number) => {
    const line = lines.find((candidate) => candidate.key === key);
    if (delta > 0 && line && leftFor(line.itemId) === 0) {
      const stock = inTicket.get(line.itemId) ?? 0;
      toast.info(`Só tem ${stock} ${line.name} no estoque: a comanda já tem todas.`, { ...POS_TOAST, id: "stock-limit" });
      return;
    }
    setLines((current) =>
      current
        .map((line) => (line.key === key ? { ...line, quantity: line.quantity + delta } : line))
        .filter((line) => line.quantity > 0)
    );
  };

  const clearTicket = () => {
    const previous = lines;
    setLines([]);
    // On phones the ticket is a drawer: an empty one has nothing left to do.
    setTicketOpen(false);
    toast("Comanda limpa", { ...POS_TOAST, action: { label: "Desfazer", onClick: () => setLines(previous) } });
  };

  // Enter in the search adds the product when only one matches.
  const addSingleResult = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter" || items.length !== 1 || !items[0].isAvailable || leftFor(items[0].id) === 0) return;
    event.preventDefault();
    quickAdd(items[0]);
    setQuery("");
  };

  const send = async ({ charge = false }: { charge?: boolean } = {}) => {
    const input = {
      customer: { name: customerName.trim() || "Balcão", phone: customerPhone || undefined },
      lines: lines.map((line) => ({
        itemId: line.itemId,
        quantity: line.quantity,
        ...lineAddonsInput(line.addons),
        notes: line.notes || undefined,
      })),
    };
    // Re-sending the same ticket after a dropped connection never creates a second order.
    const keyScope = `pos:${storeId}`;
    try {
      const order = await createOrder({
        storeId,
        input,
        idempotencyKey: stableIdempotencyKey(keyScope, input),
      }).unwrap();
      releaseIdempotencyKey(keyScope);
      toast.success(`Pedido #${order.number} enviado para a cozinha`, POS_TOAST);
      // The order is in the kitchen; the machine takes the payment now.
      if (charge) setCharging({ id: order.id, number: order.number, total: order.total });
      setLines([]);
      setCustomerName("");
      setCustomerPhone("");
      setTicketOpen(false);
    } catch (error) {
      toast.error(
        isConnectionError(error)
          ? "Sem confirmação do servidor. Envie de novo: o pedido não será duplicado."
          : getErrorMessage(error as { data?: { error?: string } }, "Não foi possível criar o pedido."),
        POS_TOAST
      );
    }
  };

  // The drawer keeps showing the ticket while it slides down after "Limpar"
  // or "Enviar" (both empty it at once).
  const drawerLines = useLastValue(lines, () => ticketOpen);
  const drawerCustomerName = useLastValue(customerName, () => ticketOpen);
  const drawerCustomerPhone = useLastValue(customerPhone, () => ticketOpen);

  const ticketProps = {
    storeId,
    lines,
    count,
    total,
    customerName,
    customerPhone,
    onCustomerName: setCustomerName,
    onCustomerPhone: setCustomerPhone,
    onQuantity: changeQuantity,
    canIncrease: (itemId: string) => leftFor(itemId) !== 0,
    onClear: clearTicket,
    onSend: () => void send(),
    onSendAndCharge: canCharge ? () => void send({ charge: true }) : undefined,
    sending,
  };

  return (
    <div className="grid min-h-[calc(100svh-3rem)] grid-cols-1 lg:h-[calc(100svh-3rem)] lg:grid-cols-[1fr_400px] lg:overflow-hidden">
      <section aria-label="Produtos" className="flex min-w-0 min-h-0 flex-col lg:overflow-y-auto">
        <div className="sticky top-12 z-10 flex flex-col gap-2 border-b bg-background/90 p-4 pb-3 backdrop-blur-md lg:top-0">
          <PendingChargesBar
            storeId={storeId}
            onOpen={(charge) => {
              setResuming(charge);
              setCharging(charge.order);
            }}
          />
          <SearchInput
            value={query}
            onValueChange={setQuery}
            onKeyDown={addSingleResult}
            placeholder="Buscar produto"
            aria-label="Buscar produto"
            className="h-10 rounded-xl"
          />
          {/* One tab stop; arrow keys move between categories. Always one selected. */}
          <ToggleGroupPrimitive
            aria-label="Categorias"
            value={[String(categoryId)]}
            onValueChange={(value: string[]) => {
              if (value[0]) setCategoryId(value[0] === "all" ? "all" : Number(value[0]));
            }}
            className="-mx-4 flex gap-1.5 overflow-x-auto px-4 scrollbar-none scroll-fade-x scroll-fade-12"
          >
            {[{ id: "all" as const, name: "Tudo", size: totalItems }, ...categories.map((c) => ({ ...c, size: c.items.length }))].map(
              (category) => {
                const selected = categoryId === category.id;
                return (
                  <Toggle
                    key={category.id}
                    value={String(category.id)}
                    className={cn(
                      "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      selected ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted"
                    )}
                  >
                    {category.name}
                    <span
                      className={cn(
                        "rounded-full px-1.5 text-xs tabular-nums",
                        selected ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground"
                      )}
                    >
                      {category.size}
                    </span>
                  </Toggle>
                );
              }
            )}
          </ToggleGroupPrimitive>
        </div>

        <div className="flex-1 p-4 pb-28 lg:pb-4">
          {isLoading || !menu ? (
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 12 }).map((_, i) => (
                <Skeleton key={i} className="h-18.5 rounded-xl" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
              <SearchX className="size-10" />
              <p className="text-sm">
                {query ? <>Nenhum produto encontrado para “{query}”.</> : "Nenhum produto nesta categoria."}
              </p>
              {query && (
                <Button variant="outline" size="sm" onClick={() => setQuery("")}>
                  Limpar busca
                </Button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {groups.map((group, groupIndex) => (
                <section key={group.id} aria-labelledby={`pos-category-${group.id}`}>
                  {/* One category selected: its name is already on the chip. */}
                  {(categoryId === "all" || query) && (
                    <h3
                      id={`pos-category-${group.id}`}
                      className="mb-2 flex items-center gap-2 text-sm font-semibold"
                    >
                      <span aria-hidden className={cn("size-2.5 rounded-full", group.accent.dot)} />
                      {group.name}
                      <span className="font-normal text-muted-foreground tabular-nums">{group.items.length}</span>
                      <span aria-hidden className="h-px flex-1 bg-border" />
                    </h3>
                  )}
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {group.items.map((item, index) => (
                      <ProductCard
                        key={item.id}
                        item={item}
                        // The first row is on screen at once (and often the LCP): no lazy loading.
                        eager={groupIndex === 0 && index < 6}
                        accent={group.accent.border}
                        quantity={inTicket.get(item.id) ?? 0}
                        left={leftFor(item.id)}
                        onAdd={() => quickAdd(item)}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </section>

      <aside className="hidden min-h-0 border-l bg-card lg:flex lg:flex-col" aria-label="Comanda">
        <Ticket {...ticketProps} />
      </aside>

      <AnimatePresence>
        {count > 0 && (
          <motion.div
            initial={{ y: 96 }}
            animate={{ y: 0 }}
            exit={{ y: 96 }}
            className="fixed inset-x-0 bottom-0 z-40 p-3 lg:hidden"
          >
            <Button size="lg" className="h-14 w-full justify-between rounded-2xl text-base shadow-xl" onClick={() => setTicketOpen(true)}>
              <span className="flex items-center gap-2">
                <ReceiptText className="size-5" /> Comanda ({count})
              </span>
              <AnimatedPrice value={total} className="font-semibold" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <ResponsiveModal open={ticketOpen} onOpenChange={setTicketOpen} title="Comanda" hideHeader>
        <Ticket
          {...ticketProps}
          lines={drawerLines}
          count={drawerLines.reduce((sum, line) => sum + line.quantity, 0)}
          total={drawerLines.reduce((sum, line) => sum + lineTotal(line), 0)}
          customerName={drawerCustomerName}
          customerPhone={drawerCustomerPhone}
          inModal
        />
      </ResponsiveModal>

      <ResponsiveModal
        open={Boolean(picking)}
        onOpenChange={(open) => !open && setPicking(null)}
        title={pickingShown?.name ?? ""}
        hideHeader
        className="sm:max-w-md"
      >
        {pickingShown && (
          <ItemCustomizer
            key={pickingShown.id}
            item={pickingShown}
            ctaLabel="Adicionar"
            alreadyChosen={inTicket.get(pickingShown.id) ?? 0}
            onAdd={(line) => {
              addToTicket(line);
              setPicking(null);
            }}
          />
        )}
      </ResponsiveModal>

      <PointChargeDialog
        storeId={storeId}
        order={charging}
        resume={resuming}
        onClose={() => {
          setCharging(null);
          setResuming(null);
        }}
      />
    </div>
  );
}

/**
 * POS toasts show at the top: the default corner (bottom right) is where the
 * ticket's "Enviar para a cozinha" button sits.
 */
const POS_TOAST = { position: "top-center" } as const;

/** Per-category color (identity, not status: raw palette on purpose): a dot on the section header and the cards' left edge. */
const CATEGORY_ACCENTS = [
  { dot: "bg-orange-500", border: "border-l-orange-500" },
  { dot: "bg-sky-500", border: "border-l-sky-500" },
  { dot: "bg-emerald-500", border: "border-l-emerald-500" },
  { dot: "bg-violet-500", border: "border-l-violet-500" },
  { dot: "bg-rose-500", border: "border-l-rose-500" },
  { dot: "bg-amber-500", border: "border-l-amber-500" },
  { dot: "bg-teal-500", border: "border-l-teal-500" },
  { dot: "bg-fuchsia-500", border: "border-l-fuchsia-500" },
];

function ProductCard({
  item,
  quantity,
  left,
  accent,
  onAdd,
  eager,
}: {
  item: PublicMenuItem;
  quantity: number;
  /** Units the stock still allows after the ticket (null = no limit). */
  left: number | null;
  /** Category color for the left edge. */
  accent: string;
  onAdd: () => void;
  /** Above the fold: load the photo right away. */
  eager?: boolean;
}) {
  const price = item.isAvailable ? formatCurrencyBRL(item.price) : "Esgotado";
  const canAdd = item.isAvailable && left !== 0;
  const hint = item.isAvailable ? stockHint(left) : null;

  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.97 }}
      disabled={!canAdd}
      onClick={onAdd}
      aria-label={`${item.name} ${price}${quantity ? `, ${quantity} na comanda` : ""}${hint ? `, ${hint.toLowerCase()}` : ""}`}
      className={cn(
        "group flex items-center gap-3 rounded-xl border border-l-4 bg-card p-2 pr-3 text-left transition-all outline-none hover:border-primary/50 hover:shadow-sm focus-visible:ring-3 focus-visible:ring-ring/50",
        accent,
        quantity > 0 && "border-primary bg-primary/5",
        !canAdd && "cursor-not-allowed opacity-50"
      )}
    >
      <div className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-muted">
        {item.photoUrl ? (
          <Image
            src={item.photoUrl}
            alt=""
            fill
            sizes="56px"
            loading={eager ? "eager" : undefined}
            className="object-cover"
          />
        ) : (
          <UtensilsCrossed className="absolute top-1/2 left-1/2 size-5 -translate-1/2 text-muted-foreground/50" />
        )}
        <AnimatePresence>
          {quantity > 0 && (
            <motion.span
              key={quantity}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center bg-primary/80 text-lg font-bold text-primary-foreground tabular-nums"
            >
              {quantity}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="line-clamp-2 text-sm leading-tight font-medium">{item.name}</span>
        <span className="mt-1 flex items-center gap-2 text-sm">
          <span className="font-semibold text-primary">{price}</span>
          {hint && (
            <span className="rounded-full bg-warning/15 px-1.5 py-0.5 text-xs font-medium text-warning">
              {hint}
            </span>
          )}
          {(item.addons.length > 0 || item.optionGroups.length > 0) && (
            <SlidersHorizontal aria-hidden className="size-3.5 text-muted-foreground">
              <title>Tem adicionais</title>
            </SlidersHorizontal>
          )}
        </span>
      </div>
      {canAdd && (
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
          <Plus className="size-4" />
        </span>
      )}
    </motion.button>
  );
}

function Ticket({
  storeId,
  lines,
  count,
  total,
  customerName,
  customerPhone,
  onCustomerName,
  onCustomerPhone,
  onQuantity,
  canIncrease,
  onClear,
  onSend,
  onSendAndCharge,
  sending,
  inModal,
}: {
  storeId: string;
  lines: TicketLine[];
  count: number;
  total: number;
  customerName: string;
  customerPhone: string;
  onCustomerName: (value: string) => void;
  onCustomerPhone: (value: string) => void;
  onQuantity: (key: string, delta: number) => void;
  /** False when the stock allows no more units of that item. */
  canIncrease: (itemId: string) => boolean;
  onClear: () => void;
  onSend: () => void;
  /** With a card machine on: send, then charge it there. */
  onSendAndCharge?: () => void;
  sending: boolean;
  /** In the phone drawer/dialog the parent scrolls, so the footer sticks. */
  inModal?: boolean;
}) {
  return (
    <div className={cn("flex flex-col", !inModal && "h-full min-h-0")}>
      <div className={cn("flex items-center justify-between gap-2 px-4 pt-4", inModal && "pr-14")}>
        <h2 className="flex items-center gap-2 font-semibold">
          <ReceiptText className="size-4 text-primary" /> Comanda
          {count > 0 && (
            <span className="text-sm font-normal text-muted-foreground">
              · {count} {count === 1 ? "item" : "itens"}
            </span>
          )}
        </h2>
        {lines.length > 0 && (
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={onClear}>
            <Trash2 /> Limpar
          </Button>
        )}
      </div>

      {/* relative: the suggestions list spans both fields. */}
      <div className="relative grid grid-cols-2 gap-2 border-b p-4">
        <CustomerAutocomplete
          storeId={storeId}
          name={customerName}
          onNameChange={onCustomerName}
          onPick={(customer) => {
            onCustomerName(customer.name);
            onCustomerPhone(customer.phone);
          }}
          // Keep a phone typed by hand; drop only the one the pick filled.
          onUnpick={(customer) => {
            if (customerPhone === customer.phone) onCustomerPhone("");
          }}
          onClear={() => {
            onCustomerName("");
            onCustomerPhone("");
          }}
        />
        <div className="relative">
          <Phone className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="tel"
            inputMode="tel"
            value={customerPhone}
            onChange={(event) => onCustomerPhone(formatPhoneBR(event.target.value))}
            placeholder="Celular"
            aria-label="Celular do cliente (opcional)"
            className="h-9 pl-8"
          />
        </div>
      </div>

      {lines.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-muted-foreground">
          <ReceiptText className="size-10 opacity-40" />
          <p className="text-sm">Toque nos produtos para montar o pedido.</p>
        </div>
      ) : (
        <ul className={cn("divide-y px-4", !inModal && "min-h-0 flex-1 overflow-y-auto")}>
          <AnimatePresence initial={false}>
            {lines.map((line) => (
              <motion.li
                key={line.key}
                layout
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-3 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-snug">{line.name}</p>
                  {line.addons.length > 0 && (
                    <p className="text-xs text-muted-foreground">+ {addonLabels(line.addons).join(", ")}</p>
                  )}
                  {line.notes && <p className="text-xs text-warning italic">“{line.notes}”</p>}
                  <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                    {line.quantity} × {formatCurrencyBRL(unitTotal(line))} ={" "}
                    <span className="font-semibold text-foreground">{formatCurrencyBRL(lineTotal(line))}</span>
                  </p>
                </div>
                <div className="flex items-center rounded-full border">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="rounded-full"
                    aria-label={line.quantity === 1 ? `Remover ${line.name}` : `Diminuir ${line.name}`}
                    onClick={() => onQuantity(line.key, -1)}
                  >
                    {line.quantity === 1 ? <Trash2 className="text-destructive" /> : <Minus />}
                  </Button>
                  <span className="w-6 text-center text-sm font-semibold tabular-nums">{line.quantity}</span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Aumentar ${line.name}`}
                    // At the stock limit it stays clickable: the click explains why.
                    aria-disabled={!canIncrease(line.itemId)}
                    className={cn("rounded-full", !canIncrease(line.itemId) && "opacity-50")}
                    onClick={() => onQuantity(line.key, 1)}
                  >
                    <Plus />
                  </Button>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}

      <div className={cn("flex flex-col gap-3 border-t bg-card p-4", inModal && "sticky bottom-0")}>
        <div className="flex items-center justify-between font-semibold">
          <span>Total</span>
          <AnimatedPrice value={total} className="text-xl" />
        </div>
        {onSendAndCharge && (
          <Button size="lg" className="h-12 w-full rounded-xl text-base" disabled={lines.length === 0 || sending} onClick={onSendAndCharge}>
            <CreditCard /> Enviar e cobrar na maquininha
          </Button>
        )}
        <Button
          size="lg"
          variant={onSendAndCharge ? "outline" : "default"}
          className="h-12 w-full rounded-xl text-base"
          disabled={lines.length === 0}
          loading={sending}
          onClick={onSend}
        >
          <Send /> {onSendAndCharge ? "Enviar e receber depois" : "Enviar para a cozinha"}
        </Button>
      </div>
    </div>
  );
}
