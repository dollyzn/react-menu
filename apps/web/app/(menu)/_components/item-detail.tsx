"use client";

import { useState } from "react";
import Image from "@/components/app/image";
import { Check, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import type { PublicMenuItem } from "@react-menu/contracts";
import { ResponsiveModal } from "@/components/app/responsive-modal";
import { AnimatedPrice } from "@/components/app/animated-price";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAppDispatch } from "@/redux/hooks";
import { addLine, type CartLine } from "@/redux/slices/cart";
import { formatCurrencyBRL } from "@/utils/string";
import { cn } from "@/lib/utils";

const NOTES_MAX = 200;

interface ItemDetailProps {
  item: PublicMenuItem | null;
  storeSlug: string;
  storeOpen: boolean;
  onClose: () => void;
}

export function ItemDetail({ item, storeSlug, storeOpen, onClose }: ItemDetailProps) {
  const dispatch = useAppDispatch();

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
  onAdd,
}: {
  item: PublicMenuItem;
  ctaLabel: string;
  disabled?: boolean;
  onAdd: (line: CustomizedLine) => void;
}) {
  const [addonIds, setAddonIds] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [quantity, setQuantity] = useState(1);

  const selected = item.addons.filter((addon) => addonIds.includes(addon.id));
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

      <div className="space-y-5 p-4">
        <div className="space-y-1">
          <h2 className={cn("text-xl font-bold text-balance", !item.photoUrl && "pr-10")}>{item.name}</h2>
          {item.description && <p className="text-sm text-muted-foreground">{item.description}</p>}
          <p className="text-lg font-semibold text-primary">{formatCurrencyBRL(item.price)}</p>
        </div>

        {item.addons.length > 0 && (
          <fieldset className="space-y-2">
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

        <div className="space-y-2">
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

      <div className="sticky bottom-0 flex items-center gap-3 border-t bg-background/95 p-4 backdrop-blur">
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
            className="rounded-full"
            aria-label="Aumentar quantidade"
            disabled={quantity >= 50}
            onClick={() => setQuantity((q) => q + 1)}
          >
            <Plus />
          </Button>
        </div>
        <Button size="lg" className="h-11 flex-1 justify-between rounded-full px-5" disabled={disabled} onClick={add}>
          {ctaLabel}
          <AnimatedPrice value={total} className="font-semibold" />
        </Button>
      </div>
    </div>
  );
}
