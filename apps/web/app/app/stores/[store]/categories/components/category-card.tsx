"use client";

import { Row } from "@tanstack/react-table";
import { format, parseISO } from "date-fns";
import { Clock, FolderOpen, Package } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { RowActions } from "./table-row-actions";
import { ItemsColumnDialog } from "./items-column-dialog";

export function CategoryCard({ row }: { row: Row<Category> }) {
  const category = row.original;

  return (
    <Card className="gap-0 py-0">
      <div className="flex items-start gap-3 p-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <FolderOpen className="size-5" />
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <h3 className="font-semibold leading-tight text-balance">{category.name}</h3>
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {category.description || "Sem descrição"}
          </p>
        </div>
        <RowActions row={row} />
      </div>
      <Separator />
      <div className="grid grid-cols-2 gap-y-2 p-4 text-xs">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Package className="size-3.5" /> Produtos
        </span>
        <span className="text-right font-medium">{category.itemsCount ?? 0}</span>
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Clock className="size-3.5" /> Atualizada
        </span>
        <span className="text-right font-medium">
          {format(parseISO(category.updatedAt), "dd/MM/yy HH:mm")}
        </span>
      </div>
      <Separator />
      <div className="p-4">
        <ItemsColumnDialog row={row} />
      </div>
    </Card>
  );
}
