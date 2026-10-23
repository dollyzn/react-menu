"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Minus, Plus } from "lucide-react";
import type { Ingredient } from "@react-menu/contracts";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useRecordStockMovementMutation } from "@/redux/features/inventory/inventoryApi";
import { formatQuantity } from "@/utils/units";
import { cn } from "@/lib/utils";

export type MovementKind = "purchase" | "waste" | "adjustment";

const COPY: Record<MovementKind, { title: string; label: string; hint: string; cta: string }> = {
  purchase: {
    title: "Registrar entrada",
    label: "Quantidade que chegou",
    hint: "Somada ao estoque atual.",
    cta: "Somar ao estoque",
  },
  waste: {
    title: "Registrar perda",
    label: "Quantidade perdida",
    hint: "Descontada do estoque (vencido, queimado, caiu no chão…).",
    cta: "Descontar do estoque",
  },
  adjustment: {
    title: "Contagem de estoque",
    label: "Quantidade contada agora",
    hint: "Substitui o estoque atual; a diferença fica registrada.",
    cta: "Salvar contagem",
  },
};

/** One-tap amounts for things counted in units (eggs, dough sheets…). */
const QUICK: Record<MovementKind, number[]> = {
  adjustment: [0, 1, 2, 3, 5, 10],
  purchase: [1, 6, 12, 30],
  waste: [1, 2, 3],
};

interface MovementDialogProps {
  storeId: string;
  ingredient: Ingredient | null;
  kind: MovementKind;
  onOpenChange: (open: boolean) => void;
}

export function MovementDialog({ storeId, ingredient, kind, onOpenChange }: MovementDialogProps) {
  const [record, { isLoading }] = useRecordStockMovementMutation();
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const copy = COPY[kind];
  const value = Number(quantity.replace(",", "."));
  const valid = quantity !== "" && Number.isFinite(value) && value >= 0 && (kind === "adjustment" || value > 0);
  const units = ingredient?.unit === "un";
  const after =
    ingredient && valid
      ? kind === "adjustment"
        ? value
        : ingredient.stockQuantity + (kind === "purchase" ? value : -value)
      : null;
  const step = (delta: number) =>
    setQuantity((current) => String(Math.max(0, (Number(current.replace(",", ".")) || 0) + delta)));

  const close = (open: boolean) => {
    if (!open) {
      setQuantity("");
      setNote("");
    }
    onOpenChange(open);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!ingredient || !valid) return;
    const updated = await record({
      storeId,
      id: ingredient.id,
      data: { type: kind, quantity: value, note: note.trim() || undefined },
    }).unwrap();
    toast.success(`${ingredient.name}: ${formatQuantity(updated.stockQuantity, updated.unit)} em estoque`);
    close(false);
  };

  return (
    <Dialog open={Boolean(ingredient)} onOpenChange={close}>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{copy.title}</DialogTitle>
            <DialogDescription>
              {ingredient?.name} · atual: {ingredient && formatQuantity(ingredient.stockQuantity, ingredient.unit)}
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="movement-quantity">
                {copy.label} ({ingredient?.unit})
              </FieldLabel>
              <div className="flex gap-2">
                {units && (
                  <Button type="button" variant="outline" size="icon" aria-label="Menos 1" onClick={() => step(-1)}>
                    <Minus />
                  </Button>
                )}
                <Input
                  id="movement-quantity"
                  inputMode="decimal"
                  autoFocus
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                  placeholder="0"
                  className={cn(units && "text-center text-lg font-semibold tabular-nums")}
                />
                {units && (
                  <Button type="button" variant="outline" size="icon" aria-label="Mais 1" onClick={() => step(1)}>
                    <Plus />
                  </Button>
                )}
              </div>
              {units && (
                <div role="group" aria-label="Valores rápidos" className="flex flex-wrap gap-1.5">
                  {QUICK[kind].map((amount) => (
                    <Button
                      key={amount}
                      type="button"
                      size="sm"
                      variant={quantity === String(amount) ? "default" : "secondary"}
                      className="min-w-10 tabular-nums"
                      onClick={() => setQuantity(String(amount))}
                    >
                      {amount}
                    </Button>
                  ))}
                </div>
              )}
              <FieldDescription>
                {copy.hint}
                {after !== null && ingredient && (
                  <>
                    {" "}
                    Fica: <strong className={cn(after < 0 && "text-destructive")}>{formatQuantity(after, ingredient.unit)}</strong>.
                  </>
                )}
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="movement-note">Observação (opcional)</FieldLabel>
              <Textarea id="movement-note" rows={2} maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} />
            </Field>
          </FieldGroup>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => close(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!valid} loading={isLoading}>
              {copy.cta}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
