"use client";

import { Row } from "@/components/app/data-table/features";
import type { OptionGroup } from "@react-menu/contracts";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { groupRule } from "./option-group-dialog";
import { OptionChips } from "./columns";
import { RowActions } from "./table-row-actions";

/** A choice group on phones (the table's renderCard). */
export function OptionGroupCard({ row }: { row: Row<OptionGroup> }) {
  const group = row.original;
  const count = group.itemsCount ?? 0;
  return (
    <Card className="gap-2 border-border bg-card p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <h3 className="leading-tight font-semibold text-balance">{group.name}</h3>
          <Badge variant={group.minChoices > 0 ? "default" : "secondary"}>{groupRule(group)}</Badge>
        </div>
        <RowActions row={row} size="icon-xs" />
      </div>
      <OptionChips group={group} />
      <Separator className="my-0.5" />
      <p className="text-xs text-muted-foreground">
        {count === 0 ? "Nenhum item usa este grupo" : count === 1 ? "Usado em 1 item" : `Usado em ${count} itens`}
      </p>
    </Card>
  );
}
