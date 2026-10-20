"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle,
  Boxes,
  ClipboardCheck,
  History,
  MinusCircle,
  MoreHorizontal,
  Pencil,
  PlusCircle,
  Trash2,
} from "lucide-react";
import type { Ingredient } from "@react-menu/contracts";
import { AlertDialogDestructive } from "@/components/app/alert-dialog-destructive";
import { SearchInput } from "@/components/app/search-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useDeleteIngredientMutation,
  useGetIngredientsQuery,
} from "@/redux/features/inventory/inventoryApi";
import { useGetStoreByIdQuery } from "@/redux/features/store/storeApi";
import { formatQuantity } from "@/utils/units";
import { normalizeSearch } from "@/utils/string";
import { cn } from "@/lib/utils";
import { IngredientDialog } from "./ingredient-dialog";
import { HistorySheet } from "./history-sheet";
import { MovementDialog, type MovementKind } from "./movement-dialog";

export default function InventoryPage() {
  const { store: storeId } = useParams<{ store: string }>();
  const { data: ingredients = [], isLoading } = useGetIngredientsQuery(storeId);
  const { data: store } = useGetStoreByIdQuery(storeId);
  const [remove, { isLoading: removing }] = useDeleteIngredientMutation();

  const [query, setQuery] = useState("");
  const [onlyLow, setOnlyLow] = useState(false);
  const [editing, setEditing] = useState<Ingredient | null | undefined>(undefined);
  const [movement, setMovement] = useState<{ ingredient: Ingredient; kind: MovementKind } | null>(null);
  const [history, setHistory] = useState<Ingredient | null>(null);
  const [deleting, setDeleting] = useState<Ingredient | null>(null);

  const lowCount = ingredients.filter((i) => i.isLowStock).length;
  const visible = useMemo(() => {
    const term = normalizeSearch(query);
    return ingredients.filter(
      (ingredient) => (!onlyLow || ingredient.isLowStock) && (!term || normalizeSearch(ingredient.name).includes(term))
    );
  }, [ingredients, query, onlyLow]);

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">Estoque</h1>
          <p className="text-sm text-muted-foreground">
            Pedidos descontam os ingredientes das receitas quando entram na cozinha.
          </p>
        </div>
        <Button onClick={() => setEditing(null)}>
          <PlusCircle /> Novo ingrediente
        </Button>
      </header>

      {store && !store.inventoryEnabled && (
        <p className="flex items-start gap-2 rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          O controle de estoque está desligado: o estoque é registrado, mas não deixa itens indisponíveis no cardápio. Ligue
          em “Editar informações” na página da loja.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          value={query}
          onValueChange={setQuery}
          placeholder="Buscar ingrediente"
          aria-label="Buscar ingrediente"
          wrapperClassName="min-w-56 flex-1"
        />
        <Button variant={onlyLow ? "default" : "outline"} aria-pressed={onlyLow} onClick={() => setOnlyLow((v) => !v)}>
          <AlertTriangle /> Acabando ({lowCount})
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed py-14 text-center text-muted-foreground">
          <Boxes className="size-8" />
          <p>{ingredients.length === 0 ? "Nenhum ingrediente cadastrado." : "Nada encontrado."}</p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((ingredient) => (
            <li
              key={ingredient.id}
              className={cn("flex flex-col gap-3 rounded-2xl border bg-card p-4", ingredient.isLowStock && "border-amber-500/50")}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{ingredient.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Mínimo {formatQuantity(ingredient.minStock, ingredient.unit)}
                  </p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Ações de ${ingredient.name}`} />}>
                    <MoreHorizontal />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setHistory(ingredient)}>
                      <History /> Histórico
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setEditing(ingredient)}>
                      <Pencil /> Editar
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onClick={() => setDeleting(ingredient)}>
                      <Trash2 /> Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-bold tabular-nums">
                  {formatQuantity(ingredient.stockQuantity, ingredient.unit)}
                </span>
                {ingredient.isLowStock && (
                  <Badge variant="outline" className="border-amber-500/50 text-amber-700 dark:text-amber-300">
                    Acabando
                  </Badge>
                )}
              </div>
              <div className="grid grid-cols-3 gap-1">
                <Button variant="outline" size="sm" onClick={() => setMovement({ ingredient, kind: "purchase" })}>
                  <PlusCircle /> Entrada
                </Button>
                <Button variant="outline" size="sm" onClick={() => setMovement({ ingredient, kind: "waste" })}>
                  <MinusCircle /> Perda
                </Button>
                <Button variant="outline" size="sm" onClick={() => setMovement({ ingredient, kind: "adjustment" })}>
                  <ClipboardCheck /> Contar
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <IngredientDialog
        storeId={storeId}
        open={editing !== undefined}
        ingredient={editing}
        onOpenChange={(open) => !open && setEditing(undefined)}
      />
      <MovementDialog
        storeId={storeId}
        ingredient={movement?.ingredient ?? null}
        kind={movement?.kind ?? "purchase"}
        onOpenChange={(open) => !open && setMovement(null)}
      />
      <HistorySheet storeId={storeId} ingredient={history} onOpenChange={(open) => !open && setHistory(null)} />
      <AlertDialogDestructive
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        loading={removing}
        title={`Excluir ${deleting?.name}?`}
        description="O ingrediente sai de todas as receitas e o histórico dele é apagado."
        onConfirm={async () => {
          if (!deleting) return;
          await remove({ storeId, id: deleting.id }).unwrap();
          toast.success("Ingrediente excluído");
          setDeleting(null);
        }}
      />
    </div>
  );
}
