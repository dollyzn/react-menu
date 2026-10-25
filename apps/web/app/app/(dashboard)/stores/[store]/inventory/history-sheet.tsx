"use client";

import { format, parseISO } from "date-fns";
import type { Ingredient, StockMovementType } from "@react-menu/contracts";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetStockMovementsQuery } from "@/redux/features/inventory/inventoryApi";
import { formatQuantity } from "@/utils/units";
import { cn } from "@/lib/utils";

const TYPE_LABELS: Record<StockMovementType, string> = {
  purchase: "Entrada",
  waste: "Perda",
  adjustment: "Contagem",
  consumption: "Pedido",
  reversal: "Pedido cancelado",
};

export function HistorySheet({
  storeId,
  ingredient,
  onOpenChange,
}: {
  storeId: string;
  ingredient: Ingredient | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: movements = [], isLoading } = useGetStockMovementsQuery(
    { storeId, id: ingredient?.id ?? 0 },
    { skip: !ingredient }
  );

  return (
    <Sheet open={Boolean(ingredient)} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Histórico · {ingredient?.name}</SheetTitle>
          <SheetDescription>Últimas 50 movimentações</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : movements.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Sem movimentações ainda.</p>
          ) : (
            <ul className="divide-y">
              {movements.map((movement) => (
                <li key={movement.id} className="flex items-start justify-between gap-3 py-3 text-sm">
                  <div>
                    <p className="font-medium">{TYPE_LABELS[movement.type]}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(parseISO(movement.createdAt), "dd/MM HH:mm")}
                      {movement.note && ` · ${movement.note}`}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "font-semibold tabular-nums",
                      movement.quantity >= 0 ? "text-success" : "text-destructive"
                    )}
                  >
                    {movement.quantity >= 0 ? "+" : ""}
                    {ingredient && formatQuantity(movement.quantity, ingredient.unit)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
