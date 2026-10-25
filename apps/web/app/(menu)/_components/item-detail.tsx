"use client";

import { useState } from "react";
import { motion } from "motion/react";
import Image from "@/components/app/image";
import { Check, Minus, Plus, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import type { PublicMenuItem } from "@react-menu/contracts";
import { ResponsiveModal } from "@/components/app/responsive-modal";
import { AnimatedPrice } from "@/components/app/animated-price";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { addLine, type CartLine } from "@/redux/slices/cart";
import { formatCurrencyBRL } from "@/utils/string";
import { cn } from "@/lib/utils";
import { stockHint, unitsLeft } from "@/lib/stock";

/** The API accepts up to 50 units per line. */
const MAX_QUANTITY = 50;

const NOTES_MAX = 200;

interface ItemDetailProps {
  item: PublicMenuItem | null;
  storeSlug: string;
  storeOpen: boolean;
  onClose: () => void;
}

export function ItemDetail({ item, storeSlug, storeOpen, onClose }: ItemDetailProps) {
  const dispatch = useAppDispatch();
  const inBag = useAppSelector((state) =>
    state.cart.storeSlug === storeSlug
      ? state.cart.lines.filter((line) => line.itemId === item?.id).reduce((sum, line) => sum + line.quantity, 0)
      : 0
  );

  return (
    <ResponsiveModal
      open={Boolean(item)}
      onOpenChange={(open) => !open && onClose()}
      title={item?.name ?? ""}
      description={item?.description ?? undefined}
      hideHeader
      className="sm:max-w-md"
    >
      {item && (
        <ItemCustomizer
          // Remount per item so choices start fresh.
          key={item.id}
          item={item}
          ctaLabel={storeOpen ? "Adicionar" : "Loja fechada"}
          disabled={!storeOpen}
          alreadyChosen={inBag}
          onAdd={(line) => {
            dispatch(addLine({ storeSlug, line }));
            toast.success(`${line.quantity}× ${item.name} na sacola`);
            onClose();
          }}
        />
      )}
    </ResponsiveModal>
  );
}

export type CustomizedLine = Omit<CartLine, "key">;

/**
 * Add-ons, notes and quantity for one menu item. Shared by the customer menu
 * (adds to the bag) and the POS (adds to the ticket).
 */
export function ItemCustomizer({
  item,
  ctaLabel,
  disabled,
  alreadyChosen = 0,
  onAdd,
}: {
  item: PublicMenuItem;
  ctaLabel: string;
  disabled?: boolean;
  /** Units of this item already in the bag/ticket (they count against the stock). */
  alreadyChosen?: number;
  onAdd: (line: CustomizedLine) => void;
}) {
  const [addonIds, setAddonIds] = useState<string[]>([]);
  /** Choices per group (option ids). */
  const [choices, setChoices] = useState<Record<string, string[]>>({});
  const [notes, setNotes] = useState("");
  const [quantity, setQuantity] = useState(1);

  const groups = item.optionGroups ?? [];
  const chosenOptions = groups.flatMap((group) =>
    group.options.filter((option) => (choices[group.id] ?? []).includes(option.id))
  );
  const missing = groups.filter((group) => (choices[group.id] ?? []).length < group.minChoices);
  const choose = (groupId: string, optionId: string, max: number) =>
    setChoices((current) => {
      const picked = current[groupId] ?? [];
      if (max === 1) return { ...current, [groupId]: picked.includes(optionId) ? [] : [optionId] };
      if (picked.includes(optionId)) return { ...current, [groupId]: picked.filter((id) => id !== optionId) };
      return picked.length >= max ? current : { ...current, [groupId]: [...picked, optionId] };
    });

  // Group choices are add-ons too: price, stock and the order line.
  const selected = [
    ...chosenOptions,
    ...item.addons.filter(
      (addon) => addonIds.includes(addon.id) && !chosenOptions.some((option) => option.id === addon.id)
    ),
  ];
  // The stock caps the quantity (the API refuses more anyway): the item and
  // every chosen add-on with a recipe.
  const left = unitsLeft(item.stockLeft, alreadyChosen);
  const limits = [
    { name: null as string | null, units: left },
    ...selected.map((addon) => ({ name: addon.name, units: addon.stockLeft })),
  ].filter((limit): limit is { name: string | null; units: number } => limit.units !== null);
  const binding = limits.reduce<(typeof limits)[number] | null>(
    (lowest, limit) => (lowest === null || limit.units < lowest.units ? limit : lowest),
    null
  );
  const maxQuantity = Math.min(MAX_QUANTITY, binding?.units ?? MAX_QUANTITY);
  // The stock (not the 50-per-line cap) stops the counter: say so, or the
  // "+" just seems broken (6 left, the customer wants 7).
  const atStockLimit = binding !== null && binding.units <= MAX_QUANTITY && quantity >= maxQuantity;
  const [nudge, setNudge] = useState(0);
  const limitMessage =
    maxQuantity < 1
      ? alreadyChosen > 0
        ? "Você já pegou todas as unidades disponíveis"
        : binding?.name
          ? `${binding.name} acabou agora`
          : "Acabou agora"
      : atStockLimit
        ? binding?.name
          ? `Só dá para ${maxQuantity} com ${binding.name} agora`
          : alreadyChosen > 0
            ? `Com o que já está no pedido, dá para mais ${maxQuantity}`
            : `Só temos ${maxQuantity} ${maxQuantity === 1 ? "disponível" : "disponíveis"} agora`
        : null;
  // Required choices first: until they're made the item can't be added.
  const hint = missing.length
    ? `Escolha: ${missing.map((group) => group.name).join(", ")}`
    : (limitMessage ?? stockHint(left));
  const total = (item.price + selected.reduce((sum, addon) => sum + addon.price, 0)) * quantity;

  const toggle = (id: string) =>
    setAddonIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
    );

  const add = () =>
    onAdd({
      itemId: item.id,
      name: item.name,
      photoUrl: item.photoUrl,
      unitPrice: item.price,
      addons: selected.map(({ id, name, price }) => ({ id, name, price })),
      notes: notes.trim(),
      quantity,
    });

  return (
    <div className="flex flex-col">
      {item.photoUrl && (
        <div className="relative aspect-16/10 w-full overflow-hidden bg-muted sm:rounded-t-xl">
          <Image
            src={item.photoUrl}
            alt={item.name}
            fill
            sizes="(max-width: 640px) 100vw, 448px"
            loading="eager"
            className="object-cover"
          />
        </div>
      )}

      <div className="flex flex-col gap-5 p-4">
        <div className="flex flex-col gap-1">
          <h2 className={cn("text-xl font-bold text-balance", !item.photoUrl && "pr-10")}>{item.name}</h2>
          {item.description && <p className="text-sm text-muted-foreground">{item.description}</p>}
          <p className="text-lg font-semibold text-primary">{formatCurrencyBRL(item.price)}</p>
        </div>

        {groups.map((group) => {
          const picked = choices[group.id] ?? [];
          const single = group.maxChoices === 1;
          const full = picked.length >= group.maxChoices;
          const rule =
            group.minChoices === group.maxChoices
              ? `Escolha ${group.maxChoices}`
              : group.minChoices > 0
                ? `Escolha de ${group.minChoices} a ${group.maxChoices}`
                : `Escolha até ${group.maxChoices}`;
          return (
            <fieldset key={group.id} className="flex flex-col gap-2">
              <legend className="mb-2 flex w-full items-center justify-between gap-2 text-sm font-semibold">
                <span>
                  {group.name}
                  <span className="block text-xs font-normal text-muted-foreground">{rule}</span>
                </span>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                    group.minChoices > 0 && picked.length < group.minChoices
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {group.minChoices > 0 ? (picked.length >= group.minChoices ? "Pronto" : "Obrigatório") : "Opcional"}
                </span>
              </legend>
              {group.options.map((option) => {
                const checked = picked.includes(option.id);
                const blocked = !option.isAvailable || (!single && full && !checked);
                return (
                  <label
                    key={option.id}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                      checked ? "border-primary bg-primary/5" : "hover:bg-muted/50",
                      blocked && "cursor-not-allowed opacity-50"
                    )}
                  >
                    <input
                      type={single ? "radio" : "checkbox"}
                      name={`group-${group.id}`}
                      className="sr-only"
                      checked={checked}
                      disabled={blocked}
                      onChange={() => choose(group.id, option.id, group.maxChoices)}
                      onClick={() => single && checked && choose(group.id, option.id, 1)}
                    />
                    <span
                      aria-hidden
                      className={cn(
                        "flex size-5 shrink-0 items-center justify-center border transition-colors",
                        single ? "rounded-full" : "rounded-md",
                        checked && "border-primary bg-primary text-primary-foreground"
                      )}
                    >
                      {checked && (single ? <span className="size-2 rounded-full bg-current" /> : <Check className="size-3.5" />)}
                    </span>
                    <span className="flex-1">
                      <span className="block text-sm font-medium">{option.name}</span>
                      {option.description && (
                        <span className="block text-xs text-muted-foreground">{option.description}</span>
                      )}
                    </span>
                    <span className="text-sm text-muted-foreground tabular-nums">
                      {!option.isAvailable ? "Esgotado" : option.price ? `+ ${formatCurrencyBRL(option.price)}` : "Incluso"}
                    </span>
                  </label>
                );
              })}
            </fieldset>
          );
        })}

        {item.addons.length > 0 && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 flex w-full items-center justify-between text-sm font-semibold">
              Adicionais
              <span className="text-xs font-normal text-muted-foreground">Opcional</span>
            </legend>
            {item.addons.map((addon) => {
              const checked = addonIds.includes(addon.id);
              return (
                <label
                  key={addon.id}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                    checked ? "border-primary bg-primary/5" : "hover:bg-muted/50",
                    !addon.isAvailable && "cursor-not-allowed opacity-50"
                  )}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={checked}
                    disabled={!addon.isAvailable}
                    onChange={() => toggle(addon.id)}
                  />
                  <span
                    aria-hidden
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors",
                      checked && "border-primary bg-primary text-primary-foreground"
                    )}
                  >
                    {checked && <Check className="size-3.5" />}
                  </span>
                  <span className="flex-1">
                    <span className="block text-sm font-medium">{addon.name}</span>
                    {addon.description && (
                      <span className="block text-xs text-muted-foreground">{addon.description}</span>
                    )}
                  </span>
                  <span className="text-sm font-medium tabular-nums">
                    {addon.isAvailable ? `+ ${formatCurrencyBRL(addon.price)}` : "Esgotado"}
                  </span>
                </label>
              );
            })}
          </fieldset>
        )}

        <div className="flex flex-col gap-2">
          <label htmlFor="item-notes" className="flex items-center justify-between text-sm font-semibold">
            Alguma observação?
            <span className="text-xs font-normal text-muted-foreground tabular-nums">
              {notes.length}/{NOTES_MAX}
            </span>
          </label>
          <Textarea
            id="item-notes"
            value={notes}
            maxLength={NOTES_MAX}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Ex.: bem passado, sem orégano…"
            rows={2}
          />
        </div>
      </div>

      {/* overflow-x-clip: the message's shake must not scroll the window sideways. */}
      <div className="sticky bottom-0 overflow-x-clip border-t bg-background/95 backdrop-blur">
      {hint && (
        <motion.p
          key={nudge}
          role="status"
          animate={nudge ? { x: [0, -6, 6, -4, 4, 0] } : undefined}
          transition={{ duration: 0.35 }}
          className="flex items-start gap-1.5 px-4 pt-3 text-sm font-medium text-warning"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <span className="min-w-0 break-words">{hint}</span>
        </motion.p>
      )}
      <div className="flex items-center gap-3 p-4">
        <div className="flex items-center rounded-full border">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            aria-label="Diminuir quantidade"
            disabled={quantity <= 1}
            onClick={() => setQuantity((q) => q - 1)}
          >
            <Minus />
          </Button>
          <span className="w-8 text-center font-semibold tabular-nums" aria-live="polite">
            {quantity}
          </span>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Aumentar quantidade"
            // At the stock limit it stays clickable and points at the message.
            aria-disabled={quantity >= maxQuantity}
            disabled={quantity >= MAX_QUANTITY}
            className={cn("rounded-full", quantity >= maxQuantity && "opacity-50")}
            onClick={() => (quantity >= maxQuantity ? setNudge((n) => n + 1) : setQuantity((q) => q + 1))}
          >
            <Plus />
          </Button>
        </div>
        <Button
          size="lg"
          className="h-11 flex-1 justify-between rounded-full px-5"
          disabled={disabled || missing.length > 0 || maxQuantity < 1 || quantity > maxQuantity}
          onClick={add}
        >
          {ctaLabel}
          <AnimatedPrice value={total} className="font-semibold" />
        </Button>
      </div>
      </div>
    </div>
  );
}
