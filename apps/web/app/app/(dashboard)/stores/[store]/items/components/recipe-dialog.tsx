"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
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
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { storeListPrefetchArg } from "@/redux/api/listQueryParams";
import {
  useGetIngredientsQuery,
  useGetItemRecipeQuery,
  useUpdateItemRecipeMutation,
} from "@/redux/features/inventory/inventoryApi";
import { randomId } from "@/lib/idempotency";

type Line = { key: string; ingredientId: number | ""; quantity: string };

interface RecipeDialogProps {
  item: Item;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Ingredients one unit of the item consumes; shown big in the kitchen. */
export function RecipeDialog({ item, open, onOpenChange }: RecipeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Receita · {item.name}</DialogTitle>
          <DialogDescription>
            Quanto de cada ingrediente vai em uma unidade. A cozinha vê o total do lote e o estoque é descontado por pedido.
          </DialogDescription>
        </DialogHeader>
        {open && <RecipeForm item={item} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function RecipeForm({ item, onDone }: { item: Item; onDone: () => void }) {
  const { store: storeId } = useParams<{ store: string }>();
  const { data: ingredientsRes, isLoading: loadingIngredients } = useGetIngredientsQuery(
    storeListPrefetchArg(storeId)
  );
  const ingredients = ingredientsRes?.data ?? [];
  const { data: recipe, isLoading: loadingRecipe } = useGetItemRecipeQuery({ storeId, itemId: item.id });
  const [save, { isLoading: saving }] = useUpdateItemRecipeMutation();
  const [lines, setLines] = useState<Line[] | null>(null);

  // Start from the saved recipe once it loads.
  const current: Line[] =
    lines ??
    (recipe ?? []).map((ingredient) => ({
      key: String(ingredient.id),
      ingredientId: ingredient.id,
      quantity: String(ingredient.quantity ?? ""),
    }));

  const update = (key: string, patch: Partial<Line>) =>
    setLines(current.map((line) => (line.key === key ? { ...line, ...patch } : line)));

  const valid = current.every(
    (line) => line.ingredientId !== "" && Number(line.quantity.replace(",", ".")) > 0
  );

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    await save({
      storeId,
      itemId: item.id,
      ingredients: current.map((line) => ({
        ingredientId: Number(line.ingredientId),
        quantity: Number(line.quantity.replace(",", ".")),
      })),
    }).unwrap();
    toast.success("Receita salva");
    onDone();
  };

  if (loadingIngredients || loadingRecipe) return <Skeleton className="h-40 w-full" />;
  if (ingredients.length === 0)
    return <p className="py-6 text-center text-sm text-muted-foreground">Cadastre ingredientes na tela de Estoque primeiro.</p>;

  return (
    <form onSubmit={submit}>
      <DialogBody className="space-y-4">
      <ul className="space-y-2">
        {current.map((line, index) => {
          const unit = ingredients.find((i) => i.id === line.ingredientId)?.unit;
          return (
            <li key={line.key} className="flex items-center gap-2">
              <NativeSelect
                aria-label={`Ingrediente ${index + 1}`}
                value={line.ingredientId === "" ? "" : String(line.ingredientId)}
                onChange={(e) => update(line.key, { ingredientId: e.target.value ? Number(e.target.value) : "" })}
                className="flex-1"
              >
                <NativeSelectOption value="">Escolha…</NativeSelectOption>
                {ingredients.map((ingredient) => (
                  <NativeSelectOption key={ingredient.id} value={String(ingredient.id)}>
                    {ingredient.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <Input
                aria-label={`Quantidade do ingrediente ${index + 1}`}
                inputMode="decimal"
                value={line.quantity}
                onChange={(e) => update(line.key, { quantity: e.target.value })}
                className="w-24"
                placeholder="0"
              />
              <span className="w-8 text-sm text-muted-foreground">{unit}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Remover ingrediente ${index + 1}`}
                onClick={() => setLines(current.filter((l) => l.key !== line.key))}
              >
                <Trash2 />
              </Button>
            </li>
          );
        })}
      </ul>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setLines([...current, { key: randomId(), ingredientId: "", quantity: "" }])}
      >
        <Plus /> Adicionar ingrediente
      </Button>
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!valid} loading={saving}>
          Salvar receita
        </Button>
      </DialogFooter>
    </form>
  );
}
