"use client";

import { useId, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Image from "@/components/app/image";
import { Check, ChevronDown, Minus, Plus, TriangleAlert } from "lucide-react";
import type { PublicMenuItem, PublicOptionGroup } from "@react-menu/contracts";
import { ResponsiveModal } from "@/components/app/responsive-modal";
import { AnimatedPrice } from "@/components/app/animated-price";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { addLine, type CartLine } from "@/redux/slices/cart";
import { formatCurrencyBRL } from "@/utils/string";
import { pickPrice, pickPricesLabel, pricedPicks } from "@/lib/choice-pricing";
import { cn } from "@/lib/utils";
import { stockHint, unitsLeft } from "@/lib/stock";
import { useLastValue } from "@/hooks/use-last-value";

/** The API accepts up to 50 units per line. */
const MAX_QUANTITY = 50;

const NOTES_MAX = 200;

interface ItemDetailProps {
  item: PublicMenuItem | null;
  storeSlug: string;
  storeOpen: boolean;
  onClose: () => void;
}

export function ItemDetail({ item: current, storeSlug, storeOpen, onClose }: ItemDetailProps) {
  const dispatch = useAppDispatch();
  // The item stays on screen while the dialog animates closed.
  const item = useLastValue(current);
  const inBag = useAppSelector((state) =>
    state.cart.storeSlug === storeSlug
      ? state.cart.lines.filter((line) => line.itemId === item?.id).reduce((sum, line) => sum + line.quantity, 0)
      : 0
  );

  return (
    <ResponsiveModal
      open={Boolean(current)}
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
            // No toast: the bag bar's count bumps, and a toast would cover it on a phone.
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
  // A pick carries its group: the price there and "Recheio extra: Carne".
  // In the order chosen: groups priced by pick order charge the 1st pick
  // its price, the 2nd the next…
  const chosenOptions = groups.flatMap((group) =>
    pricedPicks(group, choices[group.id] ?? []).map((option) => ({
      ...option,
      groupId: group.id,
      groupName: group.name,
    }))
  );
  const missing = groups.filter((group) => (choices[group.id] ?? []).length < group.minChoices);
  const choose = (groupId: string, optionId: string, max: number) =>
    setChoices((current) => {
      const picked = current[groupId] ?? [];
      if (max === 1) return { ...current, [groupId]: picked.includes(optionId) ? [] : [optionId] };
      if (picked.includes(optionId)) return { ...current, [groupId]: picked.filter((id) => id !== optionId) };
      return picked.length >= max ? current : { ...current, [groupId]: [...picked, optionId] };
    });

  // Groups that allow repeats count each option (−/+): "Queijo" twice.
  const repeat = (groupId: string, optionId: string, delta: 1 | -1, max: number) =>
    setChoices((current) => {
      const picked = current[groupId] ?? [];
      if (delta > 0) return picked.length >= max ? current : { ...current, [groupId]: [...picked, optionId] };
      const at = picked.lastIndexOf(optionId);
      return at === -1 ? current : { ...current, [groupId]: picked.filter((_, index) => index !== at) };
    });

  // Group choices are add-ons too: price, stock and the order line.
  const selected = [
    ...chosenOptions,
    ...item.addons
      .filter((addon) => addonIds.includes(addon.id))
      .map((addon) => ({ ...addon, groupId: undefined, groupName: null })),
  ];
  // The stock caps the quantity (the API refuses more anyway): the item and
  // every chosen add-on with a recipe.
  const left = unitsLeft(item.stockLeft, alreadyChosen);
  // The same add-on may be picked twice (in two groups): each unit uses both.
  const perUnit = new Map<string, { name: string; stockLeft: number | null; count: number }>();
  for (const addon of selected) {
    const entry = perUnit.get(addon.id);
    if (entry) entry.count += 1;
    else perUnit.set(addon.id, { name: addon.name, stockLeft: addon.stockLeft, count: 1 });
  }
  const limits = [
    { name: null as string | null, units: left },
    ...[...perUnit.values()].map((use) => ({
      name: use.name,
      units: use.stockLeft === null ? null : Math.floor(use.stockLeft / use.count),
    })),
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
      photoBlur: item.photoBlur,
      unitPrice: item.price,
      addons: selected.map(({ id, name, price, groupId, groupName }) =>
        groupId ? { id, name, price, groupId, groupName } : { id, name, price }
      ),
      notes: notes.trim(),
      quantity,
    });

  return (
    <div className="flex flex-col">
      {item.photoUrl && (
        <div className="relative aspect-16/10 w-full overflow-hidden bg-muted sm:rounded-t-xl">
          <Image
            src={item.photoUrl}
            blurDataURL={item.photoBlur}
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

        {groups.map((group) => (
          <ChoiceGroup
            key={group.id}
            group={group}
            picked={choices[group.id] ?? []}
            onChoose={(optionId) => choose(group.id, optionId, group.maxChoices)}
            onRepeat={(optionId, delta) => repeat(group.id, optionId, delta, group.maxChoices)}
          />
        ))}

        {item.addons.length > 0 && (
          <fieldset className="flex min-w-0 flex-col gap-2">
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
                    "relative flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
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

/**
 * One choice group. Required groups stay open; optional ones ("Recheio
 * extra") start closed with what was picked in the header, so a long list
 * of options doesn't push the rest of the item down.
 */
/** ["Queijo", "Queijo", "Carne"] → ["2× Queijo", "Carne"] (first-seen order). */
function countedNames(names: string[]) {
  const counts = new Map<string, number>();
  for (const name of names) counts.set(name, (counts.get(name) ?? 0) + 1);
  return [...counts].map(([name, count]) => (count > 1 ? `${count}× ${name}` : name));
}

function ChoiceGroup({
  group,
  picked,
  onChoose,
  onRepeat,
}: {
  group: PublicOptionGroup;
  picked: string[];
  onChoose: (optionId: string) => void;
  /** Groups that allow repeats: one more (1) or one less (-1) of an option. */
  onRepeat: (optionId: string, delta: 1 | -1) => void;
}) {
  const required = group.minChoices > 0;
  const [open, setOpen] = useState(required);
  const panelId = useId();
  const reduceMotion = useReducedMotion();
  const single = group.maxChoices === 1;
  const full = picked.length >= group.maxChoices;
  const rule =
    group.minChoices === group.maxChoices
      ? `Escolha ${group.maxChoices}`
      : required
        ? `Escolha de ${group.minChoices} a ${group.maxChoices}`
        : `Escolha até ${group.maxChoices}`;
  // "Escolha até 3 · 1º + R$ 3,00 · a partir do 2º + R$ 5,00"
  const ruleText = [
    rule,
    group.allowRepeat && "pode repetir a mesma opção",
    group.pickPrices?.length && pickPricesLabel(group.pickPrices, group.maxChoices),
  ]
    .filter(Boolean)
    .join(" · ");
  const pickedOptions = pricedPicks(group, picked);
  const pickedPrice = pickedOptions.reduce((sum, option) => sum + option.price, 0);
  // Priced by pick order: a picked option shows what it costs as picked, the
  // others what the next pick would.
  const pickedPriceOf = new Map(pickedOptions.map((option) => [option.id, option.price]));
  const nextPrice = pickPrice(group, picked.length);
  const priceLabel = (option: (typeof group.options)[number], checked: boolean) => {
    const price = group.pickPrices?.length
      ? checked
        ? pickedPriceOf.get(option.id)!
        : (nextPrice ?? option.price)
      : option.price;
    return price ? `+ ${formatCurrencyBRL(price)}` : "Incluso";
  };
  // "Frango, Mussarela · + R$ 6,00": names once, the group's total at the end.
  const summary = pickedOptions.length
    ? `${countedNames(pickedOptions.map((option) => option.name)).join(", ")}${pickedPrice ? ` · + ${formatCurrencyBRL(pickedPrice)}` : ""}`
    : null;

  const badge = (
    <span
      className={cn(
        "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
        required && picked.length < group.minChoices
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground"
      )}
    >
      {required ? (picked.length >= group.minChoices ? "Pronto" : "Obrigatório") : "Opcional"}
    </span>
  );

  const options = group.allowRepeat ? (
    <div className="flex flex-col gap-2">
      {group.options.map((option) => {
        const count = picked.filter((id) => id === option.id).length;
        const blocked = !option.isAvailable;
        return (
          <div
            key={option.id}
            className={cn(
              "flex items-center gap-3 rounded-xl border p-3 transition-colors",
              count > 0 && "border-primary bg-primary/5",
              blocked && "opacity-50"
            )}
          >
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">{option.name}</span>
              {option.description && (
                <span className="block text-xs text-muted-foreground">{option.description}</span>
              )}
              <span className="block text-xs text-muted-foreground tabular-nums">
                {blocked ? "Esgotado" : priceLabel(option, false)}
              </span>
            </span>
            <div className="flex shrink-0 items-center rounded-full border">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="rounded-full"
                aria-label={`Menos ${option.name}`}
                disabled={count === 0}
                onClick={() => onRepeat(option.id, -1)}
              >
                <Minus />
              </Button>
              <span className="w-6 text-center text-sm font-semibold tabular-nums" aria-live="polite">
                {count}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="rounded-full"
                aria-label={`Mais ${option.name}`}
                disabled={blocked || full}
                onClick={() => onRepeat(option.id, 1)}
              >
                <Plus />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  ) : (
    <div className="flex flex-col gap-2">
      {group.options.map((option) => {
        const checked = picked.includes(option.id);
        const blocked = !option.isAvailable || (!single && full && !checked);
        return (
          <label
            key={option.id}
            className={cn(
              "relative flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
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
              onChange={() => onChoose(option.id)}
              onClick={() => single && checked && onChoose(option.id)}
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
              {!option.isAvailable ? "Esgotado" : priceLabel(option, checked)}
            </span>
          </label>
        );
      })}
    </div>
  );

  if (required) {
    return (
      <fieldset className="flex min-w-0 flex-col gap-2">
        <legend className="mb-2 flex w-full items-center justify-between gap-2 text-sm font-semibold">
          <span>
            {group.name}
            <span className="block text-xs font-normal text-muted-foreground">{ruleText}</span>
          </span>
          {badge}
        </legend>
        {options}
      </fieldset>
    );
  }

  return (
    // min-w-0: a fieldset is at least as wide as its content, and a long
    // summary pushed the whole group past the dialog.
    <fieldset className="flex min-w-0 flex-col rounded-xl border">
      <legend className="sr-only">{group.name}</legend>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-2 rounded-xl p-3 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">{group.name}</span>
          <span className={cn("block text-xs text-pretty", summary ? "font-medium text-primary" : "text-muted-foreground")}>
            {summary ?? ruleText}
          </span>
        </span>
        {badge}
        <ChevronDown
          aria-hidden
          className={cn("size-4 shrink-0 text-muted-foreground transition-transform duration-200", open && "rotate-180")}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={panelId}
            key="options"
            initial={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={reduceMotion ? { opacity: 1 } : { height: "auto", opacity: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3">{options}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </fieldset>
  );
}
