"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, PlusCircle } from "lucide-react";
import type { Ingredient } from "@react-menu/contracts";
import { AlertDialogDestructive } from "@/components/app/alert-dialog-destructive";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { useTableQuery } from "@/hooks/use-table-query";
import type { StoreScopedListArg } from "@/redux/api/listQueryParams";
import {
  useDeleteIngredientMutation,
  useGetIngredientsQuery,
} from "@/redux/features/inventory/inventoryApi";
import { useGetStoreByIdQuery } from "@/redux/features/store/storeApi";
import type { PaginatedList } from "@/types/paginated-list";
import { getMetaTotal } from "@/types/paginated-list";
import { ManagementPageShell } from "../components/management-page-shell";
import { columns, columnsConfig, renderIngredientCard } from "./components/columns";
import { IngredientActionsContext, type IngredientActions } from "./components/ingredient-actions";
import { IngredientDialog } from "./ingredient-dialog";
import { HistorySheet } from "./history-sheet";
import { MovementDialog, type MovementKind } from "./movement-dialog";

export default function InventoryPage() {
  const { store: storeId } = useParams<{ store: string }>();
  const { data: store } = useGetStoreByIdQuery(storeId);
  const [remove, { isLoading: removing }] = useDeleteIngredientMutation();

  const table = useTableQuery<Ingredient, PaginatedList<Ingredient>, StoreScopedListArg>(
    useGetIngredientsQuery,
    ({ filterParam, sortingParam, paginationParam }) => ({
      storeId,
      filters: filterParam as StoreScopedListArg["filters"],
      sort: sortingParam,
      pagination: paginationParam,
    })
  );

  // How many are running low, whatever page/filter is on screen.
  const { data: lowRes } = useGetIngredientsQuery({
    storeId,
    filters: { stock: "low" },
    pagination: { page: 1, pageSize: 1 },
  });
  const lowCount = getMetaTotal(lowRes?.meta);
  const onlyLow = table.filters.some((filter) => filter.id === "stock" && String(filter.value) === "low");

  const [editing, setEditing] = useState<Ingredient | null | undefined>(undefined);
  const [movement, setMovement] = useState<{ ingredient: Ingredient; kind: MovementKind } | null>(null);
  const [history, setHistory] = useState<Ingredient | null>(null);
  const [deleting, setDeleting] = useState<Ingredient | null>(null);

  const actions = useMemo<IngredientActions>(
    () => ({
      move: (ingredient, kind) => setMovement({ ingredient, kind }),
      edit: setEditing,
      history: setHistory,
      remove: setDeleting,
    }),
    []
  );

  const toggleLow = () =>
    table.setFilters((filters) => [
      ...filters.filter((filter) => filter.id !== "stock"),
      ...(onlyLow ? [] : [{ id: "stock", value: ["low"] }]),
    ]);

  return (
    <ManagementPageShell
      storeId={storeId}
      pageLabel="Estoque"
      description="Pedidos descontam os ingredientes das receitas quando entram na cozinha."
      action={
        <>
          <Toggle
            variant="outline"
            pressed={onlyLow}
            onPressedChange={toggleLow}
            className={!onlyLow && lowCount > 0 ? "border-warning/50 text-warning" : undefined}
          >
            <AlertTriangle data-icon="inline-start" /> Acabando ({lowCount})
          </Toggle>
          <Button onClick={() => setEditing(null)}>
            <PlusCircle /> Novo ingrediente
          </Button>
        </>
      }
    >
      {store && !store.inventoryEnabled && (
        <p className="flex items-start gap-2 rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          O controle de estoque está desligado: o estoque é registrado, mas não deixa itens indisponíveis no cardápio. Ligue
          em “Editar informações” na página da loja.
        </p>
      )}

      <IngredientActionsContext.Provider value={actions}>
        <DataTable
          tableId={`ingredients-${storeId}`}
          loading={table.loading}
          data={table.data}
          rowCount={table.rowCount}
          columns={columns}
          columnsConfig={columnsConfig}
          className="bg-card"
          externalPagination={table.pagination}
          onExternalPaginationChange={table.setPagination}
          externalSorting={table.sorting}
          onExternalSortingChange={table.setSorting}
          externalColumnFilters={table.filters}
          onExternalColumnFiltersChange={table.setFilters}
          getRowId={(ingredient) => String(ingredient.id)}
          renderCard={renderIngredientCard}
          defaultViewMode="cards"
          cardsContainerClassName="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
        />
      </IngredientActionsContext.Provider>

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
    </ManagementPageShell>
  );
}
