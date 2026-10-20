"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { Ingredient, IngredientUnit } from "@react-menu/contracts";
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
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import {
  useCreateIngredientMutation,
  useUpdateIngredientMutation,
} from "@/redux/features/inventory/inventoryApi";
import { unitLabels } from "@/utils/units";

interface IngredientDialogProps {
  storeId: string;
  open: boolean;
  /** Present when editing. */
  ingredient?: Ingredient | null;
  onOpenChange: (open: boolean) => void;
}

const toNumber = (value: string) => Number(value.replace(",", "."));

export function IngredientDialog({ storeId, open, ingredient, onOpenChange }: IngredientDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open && (
          <IngredientForm key={ingredient?.id ?? "new"} storeId={storeId} ingredient={ingredient} onDone={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function IngredientForm({
  storeId,
  ingredient,
  onDone,
}: {
  storeId: string;
  ingredient?: Ingredient | null;
  onDone: () => void;
}) {
  const [create, { isLoading: creating }] = useCreateIngredientMutation();
  const [update, { isLoading: updating }] = useUpdateIngredientMutation();
  const [name, setName] = useState(ingredient?.name ?? "");
  const [unit, setUnit] = useState<IngredientUnit>(ingredient?.unit ?? "g");
  const [minStock, setMinStock] = useState(String(ingredient?.minStock ?? ""));
  const [stock, setStock] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const data = { name: name.trim(), unit, minStock: minStock ? toNumber(minStock) : 0 };
    if (ingredient) {
      await update({ storeId, id: ingredient.id, data }).unwrap();
      toast.success("Ingrediente atualizado");
    } else {
      await create({ storeId, data: { ...data, stockQuantity: stock ? toNumber(stock) : undefined } }).unwrap();
      toast.success("Ingrediente criado");
    }
    onDone();
  };

  return (
    <form onSubmit={submit}>
      <DialogHeader>
        <DialogTitle>{ingredient ? "Editar ingrediente" : "Novo ingrediente"}</DialogTitle>
        <DialogDescription>Use a mesma unidade das receitas (ex.: gramas para recheios).</DialogDescription>
      </DialogHeader>
      <DialogBody>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="ingredient-name">Nome</FieldLabel>
          <Input id="ingredient-name" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Carne moída" />
        </Field>
        <Field>
          <FieldLabel htmlFor="ingredient-unit">Unidade</FieldLabel>
          <NativeSelect id="ingredient-unit" value={unit} onChange={(e) => setUnit(e.target.value as IngredientUnit)}>
            {Object.entries(unitLabels).map(([value, label]) => (
              <NativeSelectOption key={value} value={value}>
                {label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        {!ingredient && (
          <Field>
            <FieldLabel htmlFor="ingredient-stock">Estoque inicial ({unit})</FieldLabel>
            <Input id="ingredient-stock" inputMode="decimal" value={stock} onChange={(e) => setStock(e.target.value)} placeholder="0" />
          </Field>
        )}
        <Field>
          <FieldLabel htmlFor="ingredient-min">Estoque mínimo ({unit})</FieldLabel>
          <Input id="ingredient-min" inputMode="decimal" value={minStock} onChange={(e) => setMinStock(e.target.value)} placeholder="0" />
          <FieldDescription>Abaixo disso o ingrediente aparece como “acabando”.</FieldDescription>
        </Field>
      </FieldGroup>
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!name.trim()} loading={creating || updating}>
          Salvar
        </Button>
      </DialogFooter>
    </form>
  );
}
