import type { RowData } from "@tanstack/react-table";
import { Column } from "@/components/app/data-table/features";
import {
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  EyeOff,
  FunnelX,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface DataTableColumnHeaderProps<
  TData extends RowData,
  TValue,
> extends React.HTMLAttributes<HTMLDivElement> {
  column: Column<TData, TValue>;
  title: string;
  titleClassName?: string;
}

/**
 * Every column title looks the same, sortable or not (small caps in the muted
 * color); `titleClassName` only adds to it.
 */
export const COLUMN_TITLE = "text-xs font-medium uppercase tracking-wider text-muted-foreground";

export function DataTableColumnHeader<TData extends RowData, TValue>({
  column,
  title,
  className,
  titleClassName,
}: DataTableColumnHeaderProps<TData, TValue>) {
  if (!column.getCanSort()) {
    // Same height as the sortable ones' button, so the titles line up.
    return (
      <div className={cn("flex h-8 items-center", className)}>
        <span className={cn(COLUMN_TITLE, titleClassName)}>{title}</span>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <DropdownMenu>
        <div className="flex items-center gap-1">
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="sm"
                className="-ml-3 h-8 data-[state=open]:bg-accent"
              />
            }
          >
            <span className={cn(COLUMN_TITLE, titleClassName)}>{title}</span>
            {column.getIsSorted() === "desc" ? (
              <ArrowDown />
            ) : column.getIsSorted() === "asc" ? (
              <ArrowUp />
            ) : (
              <ChevronsUpDown />
            )}
          </DropdownMenuTrigger>
          {column.getIsSorted() && (
            <Button
              size="icon"
              className="size-7"
              variant="ghost"
              aria-label="Remover ordenação"
              onClick={() => column.clearSorting()}
            >
              <FunnelX size={14} className="size-auto" />
            </Button>
          )}
        </div>
        <DropdownMenuContent align="start" className="min-w-40">
          <DropdownMenuItem onClick={() => column.toggleSorting(false)}>
            <ArrowUp className="size-3.5 text-muted-foreground/70" />
            Menor para Maior
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => column.toggleSorting(true)}>
            <ArrowDown className="size-3.5 text-muted-foreground/70" />
            Maior para Menor
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => column.toggleVisibility(false)}>
            <EyeOff className="size-3.5 text-muted-foreground/70" />
            Esconder
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
