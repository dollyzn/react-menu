"use client";

import { useState } from "react";
import { toast } from "sonner";
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
              <Input
                id="movement-quantity"
                inputMode="decimal"
                autoFocus
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                placeholder="0"
              />
              <FieldDescription>{copy.hint}</FieldDescription>
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
