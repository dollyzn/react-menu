"use client";

import { useMemo, useState } from "react";
import { Toggle } from "@base-ui/react/toggle";
import { ToggleGroup as ToggleGroupPrimitive } from "@base-ui/react/toggle-group";
import { useParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { Minus, Pause, Phone, Plus, ReceiptText, SearchX, SmartphoneNfc, Store, Trash2, User } from "lucide-react";
import type { PointCharge, PublicMenuItem } from "@react-menu/contracts";
import { ItemCustomizer, type CustomizedLine } from "@/app/(menu)/_components/item-detail";
import { AnimatedPrice } from "@/components/app/animated-price";
import { ResponsiveModal } from "@/components/app/responsive-modal";
import { SearchInput } from "@/components/app/search-input";
import { PointChargeDialog } from "@/components/app/point/point-charge-dialog";
import { PendingChargesBar } from "@/components/app/point/pending-charges-bar";
import { CATEGORY_ACCENTS, ProductCard } from "@/components/app/pos/product-card";
import { PartnerAreaGate } from "@/components/app/partner/partner-area-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useLastValue } from "@/hooks/use-last-value";
import { addonLabels } from "@/lib/addon-label";
import { randomId, releaseIdempotencyKey, stableIdempotencyKey } from "@/lib/idempotency";
import { commissionFor, commissionRuleLabel } from "@/lib/partner-commission";
import { unitsLeft } from "@/lib/stock";
import { cn } from "@/lib/utils";
import {
  useCreatePartnerOrderMutation,
  useGetPartnerContextQuery,
  useGetPartnerMenuQuery,
} from "@/redux/features/partner/partnerAreaApi";
import { lineAddonsInput } from "@/redux/slices/cart";
import { formatCurrencyBRL, formatPhoneBR, normalizeSearch } from "@/utils/string";

type TicketLine = CustomizedLine & { key: string };
const unitTotal = (line: CustomizedLine) => line.unitPrice + line.addons.reduce((sum, addon) => sum + addon.price, 0);
const lineTotal = (line: CustomizedLine) => unitTotal(line) * line.quantity;

const TOAST = { position: "top-center" } as const;

/**
 * The partner's point of sale (ADR 0024): what the store lets them sell,
 * for their customer, charged on the machine the store lent them. The
 * order reaches the store's kitchen only once the machine approves it.
 */
export default function PartnerPosPage() {
  const { store: storeId } = useParams<{ store: string }>();
  return (
    <PartnerAreaGate storeId={storeId}>
      <PartnerPos storeId={storeId} />
    </PartnerAreaGate>
  );
}

function PartnerPos({ storeId }: { storeId: string }) {
  const { data: context } = useGetPartnerContextQuery(storeId);
  const { data: menu, isLoading } = useGetPartnerMenuQuery(storeId);
  const [createOrder] = useCreatePartnerOrderMutation();

  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState<number | "all">("all");
  const [lines, setLines] = useState<TicketLine[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [nameMissing, setNameMissing] = useState(false);
  const [ticketOpen, setTicketOpen] = useState(false);
  const [picking, setPicking] = useState<{ item: PublicMenuItem; session: number } | null>(null);
  const pickingShown = useLastValue(picking);
  const [charging, setCharging] = useState<{ id: string; number: number; total: number } | null>(null);
  const [resuming, setResuming] = useState<PointCharge | null>(null);
  const [selling, setSelling] = useState<{ total: number; create: () => Promise<{ id: string; number: number; total: number; status: "pending_payment" }> } | null>(null);

  const categories = useMemo(() => menu?.categories ?? [], [menu]);
  const groups = useMemo(() => {
    const term = normalizeSearch(query);
    return categories
      .map((category, index) => ({
        id: category.id,
        name: category.name,
        accent: CATEGORY_ACCENTS[index % CATEGORY_ACCENTS.length],
        items: category.items.filter(
          (item) => !term || normalizeSearch(`${item.name} ${item.description ?? ""}`).includes(term)
        ),
      }))
      .filter((group) => (categoryId === "all" || group.id === categoryId) && group.items.length > 0);
  }, [categories, query, categoryId]);
  const inTicket = useMemo(() => {
    const counts = new Map<string, number>();
    for (const line of lines) counts.set(line.itemId, (counts.get(line.itemId) ?? 0) + line.quantity);
    return counts;
  }, [lines]);
  const stockOf = useMemo(
    () => new Map(categories.flatMap((category) => category.items).map((item) => [item.id, item.stockLeft])),
    [categories]
  );
  const leftFor = (itemId: string) => unitsLeft(stockOf.get(itemId) ?? null, inTicket.get(itemId) ?? 0);

  const total = Math.round(lines.reduce((sum, line) => sum + lineTotal(line), 0) * 100) / 100;
  const count = lines.reduce((sum, line) => sum + line.quantity, 0);
  const rule = context?.partner.commission;
  const commission = rule ? commissionFor(rule, { subtotal: total, units: count }) : 0;

  const terminal = context?.terminal ?? null;
  const paused = Boolean(context?.partner.paused);
  const closed = context ? !context.store.isOpen : false;
  const cantSell = !terminal || paused || closed || !context?.point.available;

  const addToTicket = (line: CustomizedLine) =>
    setLines((current) => {
      const same = current.find(
        (l) => l.itemId === line.itemId && !l.notes && !line.notes && l.addons.length === 0 && line.addons.length === 0
      );
      if (same) return current.map((l) => (l === same ? { ...l, quantity: l.quantity + line.quantity } : l));
      return [...current, { ...line, key: randomId() }];
    });
  const quickAdd = (item: PublicMenuItem) => {
    if (item.addons.length > 0 || item.optionGroups.length > 0) {
      setPicking((current) => ({ item, session: (current?.session ?? 0) + 1 }));
      return;
    }
    addToTicket({ itemId: item.id, name: item.name, photoUrl: item.photoUrl, unitPrice: item.price, addons: [], notes: "", quantity: 1 });
  };
  const changeQuantity = (key: string, delta: number) => {
    const line = lines.find((candidate) => candidate.key === key);
    if (delta > 0 && line && leftFor(line.itemId) === 0) {
      toast.info(`A loja não tem mais ${line.name} agora.`, { ...TOAST, id: "stock-limit" });
      return;
    }
    setLines((current) =>
      current
        .map((candidate) => (candidate.key === key ? { ...candidate, quantity: candidate.quantity + delta } : candidate))
        .filter((candidate) => candidate.quantity > 0)
    );
  };

  /**
   * "Vender e cobrar na maquininha": the charge dialog creates the order
   * when the charge is sent (`prepare`), so closing it first sells nothing.
   */
  const sell = () => {
    if (!customerName.trim()) {
      setNameMissing(true);
      return;
    }
    const input = {
      customer: { name: customerName.trim(), phone: customerPhone || undefined },
      lines: lines.map((line) => ({
        itemId: line.itemId,
        quantity: line.quantity,
        ...lineAddonsInput(line.addons),
        notes: line.notes || undefined,
      })),
    };
    setTicketOpen(false);
    setSelling({
      total,
      create: async () => {
        const scope = `partner-pos:${storeId}`;
        const order = await createOrder({ storeId, input, idempotencyKey: stableIdempotencyKey(scope, input) }).unwrap();
        releaseIdempotencyKey(scope);
        setLines([]);
        setCustomerName("");
        setCustomerPhone("");
        return { id: order.id, number: order.number, total: order.total, status: "pending_payment" as const };
      },
    });
  };

  const ticket = (
    <Ticket
      lines={lines}
      total={total}
      count={count}
      commission={commission}
      customerName={customerName}
      customerPhone={customerPhone}
      nameMissing={nameMissing}
      onCustomerName={(value) => {
        setCustomerName(value);
        if (value.trim()) setNameMissing(false);
      }}
      onCustomerPhone={setCustomerPhone}
      onQuantity={changeQuantity}
      canIncrease={(itemId) => leftFor(itemId) !== 0}
      onSell={sell}
      disabled={cantSell}
      machineName={terminal?.name ?? null}
    />
  );

  return (
    <div className="grid min-h-[calc(100svh-3rem)] grid-cols-1 lg:h-[calc(100svh-3rem)] lg:grid-cols-[1fr_380px] lg:overflow-hidden">
      <section aria-label="Produtos" className="flex min-h-0 min-w-0 flex-col lg:overflow-y-auto">
        <div className="sticky top-12 z-10 flex flex-col gap-2 border-b bg-background/90 p-4 pb-3 backdrop-blur-md lg:top-0">
          {context && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span className="font-semibold">{context.partner.name}</span>
              <span className="text-muted-foreground">vende {context.store.name}</span>
              {rule && (
                <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                  Comissão: {commissionRuleLabel(rule)}
                </span>
              )}
            </div>
          )}
          {context && cantSell && (
            <div role="status" className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
              {paused ? <Pause className="mt-0.5 size-4 shrink-0" /> : closed ? <Store className="mt-0.5 size-4 shrink-0" /> : <SmartphoneNfc className="mt-0.5 size-4 shrink-0" />}
              <span>
                {paused
                  ? "A loja pausou as suas vendas por enquanto. Fale com eles para voltar."
                  : closed
                    ? `${context.store.name} está fechada agora: os pedidos voltam quando abrir.`
                    : "Ainda não há uma maquininha liberada para você. Peça para a loja liberar uma."}
              </span>
            </div>
          )}
          <PendingChargesBar
            storeId={storeId}
            area="partner"
            onOpen={(charge) => {
              setResuming(charge);
              setCharging(charge.order);
            }}
          />
          <SearchInput
            value={query}
            onValueChange={setQuery}
            placeholder="Buscar produto"
            aria-label="Buscar produto"
            className="h-10 rounded-xl"
          />
          {/* One tab stop; arrow keys move between categories (the store's POS chips). */}
          <ToggleGroupPrimitive
            aria-label="Categorias"
            value={[String(categoryId)]}
            onValueChange={(value: string[]) => {
              if (value[0]) setCategoryId(value[0] === "all" ? "all" : Number(value[0]));
            }}
            className="-mx-4 flex gap-1.5 overflow-x-auto px-4 scrollbar-none scroll-fade-x scroll-fade-12"
          >
            {[
              { id: "all" as const, name: "Tudo", size: categories.reduce((sum, category) => sum + category.items.length, 0) },
              ...categories.map((category) => ({ ...category, size: category.items.length })),
            ].map((category) => {
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
            })}
          </ToggleGroupPrimitive>
        </div>

        <div className="flex-1 p-4 pb-28 lg:pb-4">
          {isLoading || !menu ? (
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 9 }).map((_, i) => (
                <Skeleton key={i} className="h-18.5 rounded-xl" />
              ))}
            </div>
          ) : groups.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
              <SearchX className="size-10" />
              <p className="text-sm">
                {query ? <>Nenhum produto encontrado para “{query}”.</> : "Nenhum produto liberado para você vender."}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {groups.map((group, groupIndex) => (
                <section key={group.id} aria-labelledby={`partner-category-${group.id}`}>
                  <h3 id={`partner-category-${group.id}`} className="mb-2 flex items-center gap-2 text-sm font-semibold">
                    <span aria-hidden className={cn("size-2.5 rounded-full", group.accent.dot)} />
                    {group.name}
                    <span aria-hidden className="h-px flex-1 bg-border" />
                  </h3>
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {group.items.map((item, index) => (
                      <ProductCard
                        key={item.id}
                        item={item}
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

      <aside className="hidden min-h-0 border-l bg-card lg:flex lg:flex-col" aria-label="Venda">
        {ticket}
      </aside>

      <AnimatePresence>
        {count > 0 && (
          <motion.div initial={{ y: 96 }} animate={{ y: 0 }} exit={{ y: 96 }} className="fixed inset-x-0 bottom-0 z-40 p-3 lg:hidden">
            <Button size="lg" className="h-14 w-full justify-between rounded-2xl text-base shadow-xl" onClick={() => setTicketOpen(true)}>
              <span className="flex items-center gap-2">
                <ReceiptText className="size-5" /> Venda ({count})
              </span>
              <AnimatedPrice value={total} className="font-semibold" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <ResponsiveModal open={ticketOpen} onOpenChange={setTicketOpen} title="Venda" hideHeader>
        {ticket}
      </ResponsiveModal>

      <ResponsiveModal
        open={Boolean(picking)}
        onOpenChange={(open) => !open && setPicking(null)}
        title={pickingShown?.item.name ?? ""}
        hideHeader
        className="sm:max-w-md"
      >
        {pickingShown && (
          <ItemCustomizer
            key={pickingShown.session}
            item={pickingShown.item}
            ctaLabel="Adicionar"
            alreadyChosen={inTicket.get(pickingShown.item.id) ?? 0}
            onAdd={(line) => {
              addToTicket(line);
              setPicking(null);
            }}
          />
        )}
      </ResponsiveModal>

      <PointChargeDialog
        storeId={storeId}
        area="partner"
        order={charging}
        prepare={charging ? null : selling}
        resume={resuming}
        onClose={() => {
          setCharging(null);
          setSelling(null);
          setResuming(null);
        }}
        onPaid={() => toast.success("Pago! O pedido foi para a cozinha da loja.", TOAST)}
      />
    </div>
  );
}

function Ticket({
  lines,
  total,
  count,
  commission,
  customerName,
  customerPhone,
  nameMissing,
  onCustomerName,
  onCustomerPhone,
  onQuantity,
  canIncrease,
  onSell,
  disabled,
  machineName,
}: {
  lines: TicketLine[];
  total: number;
  count: number;
  commission: number;
  customerName: string;
  customerPhone: string;
  nameMissing: boolean;
  onCustomerName: (value: string) => void;
  onCustomerPhone: (value: string) => void;
  onQuantity: (key: string, delta: number) => void;
  canIncrease: (itemId: string) => boolean;
  onSell: () => void;
  disabled: boolean;
  machineName: string | null;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-col gap-2 border-b p-4">
        <h2 className="text-base font-semibold">Venda</h2>
        <div className="relative">
          <User className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={customerName}
            onChange={(event) => onCustomerName(event.target.value)}
            placeholder="Nome do cliente"
            aria-label="Nome do cliente"
            aria-invalid={nameMissing}
            className="h-9 pl-8"
          />
        </div>
        {nameMissing && <p className="text-xs text-destructive">Informe o nome: é como a loja e você vão chamar o pedido.</p>}
        <div className="relative">
          <Phone className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="tel"
            inputMode="tel"
            value={customerPhone}
            onChange={(event) => onCustomerPhone(formatPhoneBR(event.target.value))}
            placeholder="Celular (opcional)"
            aria-label="Celular do cliente (opcional)"
            className="h-9 pl-8"
          />
        </div>
      </div>

      {lines.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-muted-foreground">
          <ReceiptText className="size-10 opacity-40" />
          <p className="text-sm">Toque nos produtos para montar a venda.</p>
        </div>
      ) : (
        <ul className="min-h-0 flex-1 divide-y overflow-y-auto px-4">
          {lines.map((line) => (
            <li key={line.key} className="flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-snug font-medium">{line.name}</p>
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
                  aria-disabled={!canIncrease(line.itemId)}
                  className={cn("rounded-full", !canIncrease(line.itemId) && "opacity-50")}
                  onClick={() => onQuantity(line.key, 1)}
                >
                  <Plus />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-3 border-t bg-card p-4 tall:sticky tall:bottom-0">
        <div className="flex items-center justify-between font-semibold">
          <span>Total {count > 0 && <span className="font-normal text-muted-foreground">· {count} {count === 1 ? "item" : "itens"}</span>}</span>
          <AnimatedPrice value={total} className="text-xl" />
        </div>
        {count > 0 && (
          <div className="flex items-center justify-between rounded-lg bg-success/10 px-3 py-2 text-sm text-success">
            <span>Sua comissão nesta venda</span>
            <span className="font-semibold tabular-nums">{formatCurrencyBRL(commission)}</span>
          </div>
        )}
        <Button size="lg" className="h-12 w-full rounded-xl text-base" disabled={lines.length === 0 || disabled} onClick={onSell}>
          <SmartphoneNfc /> Vender e cobrar na maquininha
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          {machineName ? `Cobra na ${machineName}. ` : ""}O pedido vai para a cozinha da loja quando o pagamento for aprovado.
        </p>
      </div>
    </div>
  );
}
