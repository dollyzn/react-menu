"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { Minus, Plus, ReceiptText, Search, Send, Trash2 } from "lucide-react";
import type { PublicMenuItem } from "@react-menu/contracts";
import { ItemCustomizer, type CustomizedLine } from "@/app/(menu)/_components/item-detail";
import { AnimatedPrice } from "@/components/app/animated-price";
import { ResponsiveModal } from "@/components/app/responsive-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetPublicMenuQuery } from "@/redux/features/public/publicApi";
import { useCreatePosOrderMutation } from "@/redux/features/order/orderApi";
import { useGetStoreByIdQuery } from "@/redux/features/store/storeApi";
import { formatCurrencyBRL, formatPhoneBR, normalizeSearch } from "@/utils/string";
import { getErrorMessage } from "@/utils/get-error-message";
import { cn } from "@/lib/utils";

type TicketLine = CustomizedLine & { key: string };
const lineTotal = (line: CustomizedLine) =>
  (line.unitPrice + line.addons.reduce((sum, addon) => sum + addon.price, 0)) * line.quantity;

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
  const [lines, setLines] = useState<TicketLine[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [ticketOpen, setTicketOpen] = useState(false);

  const items = useMemo(() => {
    const term = normalizeSearch(query);
    return (menu?.categories ?? [])
      .filter((category) => categoryId === "all" || category.id === categoryId)
      .flatMap((category) => category.items)
      .filter((item) => !term || normalizeSearch(`${item.name} ${item.description ?? ""}`).includes(term));
  }, [menu, query, categoryId]);

  const total = lines.reduce((sum, line) => sum + lineTotal(line), 0);
  const count = lines.reduce((sum, line) => sum + line.quantity, 0);

  const quickAdd = (item: PublicMenuItem) => {
    if (item.addons.length > 0) return setPicking(item);
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
      return [...current, { ...line, key: crypto.randomUUID() }];
    });
  };

  const changeQuantity = (key: string, delta: number) =>
    setLines((current) =>
      current
        .map((line) => (line.key === key ? { ...line, quantity: line.quantity + delta } : line))
        .filter((line) => line.quantity > 0)
    );

  const send = async () => {
    try {
      const order = await createOrder({
        storeId,
        input: {
          customer: { name: customerName.trim() || "Balcão", phone: customerPhone || undefined },
          lines: lines.map((line) => ({
            itemId: line.itemId,
            quantity: line.quantity,
            addonIds: line.addons.map((addon) => addon.id),
            notes: line.notes || undefined,
          })),
        },
      }).unwrap();
      toast.success(`Pedido #${order.number} enviado para a cozinha`);
      setLines([]);
      setCustomerName("");
      setCustomerPhone("");
      setTicketOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error as { data?: { error?: string } }, "Não foi possível criar o pedido."));
    }
  };

  const ticket = (
    <Ticket
      lines={lines}
      total={total}
      customerName={customerName}
      customerPhone={customerPhone}
      onCustomerName={setCustomerName}
      onCustomerPhone={setCustomerPhone}
      onQuantity={changeQuantity}
      onSend={send}
      sending={sending}
    />
  );

  return (
    <div className="grid min-h-[calc(100svh-3rem)] lg:grid-cols-[1fr_380px]">
      <div className="flex flex-col gap-3 p-4 pb-28 lg:pb-4">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar produto"
            aria-label="Buscar produto"
            className="h-10 pl-9"
          />
        </div>
        <div className="-mx-4 flex gap-1 overflow-x-auto px-4 [scrollbar-width:none]" role="tablist" aria-label="Categorias">
          {[{ id: "all" as const, name: "Tudo" }, ...(menu?.categories ?? [])].map((category) => (
            <button
              key={category.id}
              type="button"
              role="tab"
              aria-selected={categoryId === category.id}
              onClick={() => setCategoryId(category.id)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
                categoryId === category.id ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"
              )}
            >
              {category.name}
            </button>
          ))}
        </div>

        {isLoading || !menu ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
            {items.map((item) => (
              <motion.button
                key={item.id}
                type="button"
                whileTap={{ scale: 0.96 }}
                disabled={!item.isAvailable}
                onClick={() => quickAdd(item)}
                className={cn(
                  "flex flex-col overflow-hidden rounded-xl border bg-card text-left transition-shadow hover:shadow-md",
                  !item.isAvailable && "cursor-not-allowed opacity-50"
                )}
              >
                <div className="relative h-20 w-full bg-muted">
                  {item.photoUrl && <Image src={item.photoUrl} alt="" fill sizes="200px" className="object-cover" />}
                </div>
                <div className="flex flex-1 flex-col p-2">
                  <span className="line-clamp-2 text-sm leading-tight font-medium">{item.name}</span>
                  <span className="mt-auto pt-1 text-sm font-semibold text-primary">
                    {item.isAvailable ? formatCurrencyBRL(item.price) : "Esgotado"}
                  </span>
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </div>

      <aside className="hidden border-l bg-card lg:flex lg:flex-col" aria-label="Comanda">
        {ticket}
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

      <ResponsiveModal open={ticketOpen} onOpenChange={setTicketOpen} title="Comanda">
        {ticket}
      </ResponsiveModal>

      <ResponsiveModal
        open={Boolean(picking)}
        onOpenChange={(open) => !open && setPicking(null)}
        title={picking?.name ?? ""}
        hideHeader
        className="sm:max-w-md"
      >
        {picking && (
          <ItemCustomizer
            key={picking.id}
            item={picking}
            ctaLabel="Adicionar"
            onAdd={(line) => {
              addToTicket(line);
              setPicking(null);
            }}
          />
        )}
      </ResponsiveModal>
    </div>
  );
}

function Ticket({
  lines,
  total,
  customerName,
  customerPhone,
  onCustomerName,
  onCustomerPhone,
  onQuantity,
  onSend,
  sending,
}: {
  lines: TicketLine[];
  total: number;
  customerName: string;
  customerPhone: string;
  onCustomerName: (value: string) => void;
  onCustomerPhone: (value: string) => void;
  onQuantity: (key: string, delta: number) => void;
  onSend: () => void;
  sending: boolean;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="space-y-2 border-b p-4">
        <Input
          value={customerName}
          onChange={(event) => onCustomerName(event.target.value)}
          placeholder="Nome do cliente (ou Balcão)"
          aria-label="Nome do cliente"
        />
        <Input
          type="tel"
          inputMode="tel"
          value={customerPhone}
          onChange={(event) => onCustomerPhone(formatPhoneBR(event.target.value))}
          placeholder="Celular (opcional)"
          aria-label="Celular do cliente"
        />
      </div>
      {lines.length === 0 ? (
        <p className="flex-1 p-8 text-center text-sm text-muted-foreground">Toque nos produtos para montar o pedido.</p>
      ) : (
        <ul className="flex-1 divide-y overflow-y-auto px-4">
          {lines.map((line) => (
            <li key={line.key} className="flex items-center gap-2 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{line.name}</p>
                {line.addons.length > 0 && (
                  <p className="text-xs text-muted-foreground">+ {line.addons.map((a) => a.name).join(", ")}</p>
                )}
                {line.notes && <p className="text-xs text-amber-700 italic dark:text-amber-300">“{line.notes}”</p>}
                <p className="text-sm font-semibold tabular-nums">{formatCurrencyBRL(lineTotal(line))}</p>
              </div>
              <div className="flex items-center rounded-full border">
                <Button variant="ghost" size="icon-sm" className="rounded-full" aria-label={`Diminuir ${line.name}`} onClick={() => onQuantity(line.key, -1)}>
                  {line.quantity === 1 ? <Trash2 className="text-destructive" /> : <Minus />}
                </Button>
                <span className="w-6 text-center text-sm font-semibold tabular-nums">{line.quantity}</span>
                <Button variant="ghost" size="icon-sm" className="rounded-full" aria-label={`Aumentar ${line.name}`} onClick={() => onQuantity(line.key, 1)}>
                  <Plus />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="space-y-3 border-t p-4">
        <div className="flex items-center justify-between font-semibold">
          <span>Total</span>
          <AnimatedPrice value={total} className="text-lg" />
        </div>
        <Button size="lg" className="h-12 w-full rounded-xl" disabled={lines.length === 0} loading={sending} onClick={onSend}>
          <Send /> Enviar para a cozinha
        </Button>
      </div>
    </div>
  );
}
