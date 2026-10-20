import { Column } from "@tanstack/react-table";
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
  TData,
  TValue,
> extends React.HTMLAttributes<HTMLDivElement> {
  column: Column<TData, TValue>;
  title: string;
  titleClassName?: string;
}

export function DataTableColumnHeader<TData, TValue>({
  column,
  title,
  className,
  titleClassName,
}: DataTableColumnHeaderProps<TData, TValue>) {
  if (!column.getCanSort()) {
    return <div className={cn(className)}>{title}</div>;
  }

  return (
    <div className={cn("flex items-center space-x-2", className)}>
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
            <span className={titleClassName}>{title}</span>
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
              onClick={column.clearSorting}
            >
              <FunnelX size={14} className="size-auto" />
            </Button>
          )}
        </div>
        <DropdownMenuContent align="start" className="min-w-40">
          <DropdownMenuItem onClick={() => column.toggleSorting(false)}>
            <ArrowUp className="h-3.5 w-3.5 text-muted-foreground/70" />
            Menor para Maior
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => column.toggleSorting(true)}>
            <ArrowDown className="h-3.5 w-3.5 text-muted-foreground/70" />
            Maior para Menor
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => column.toggleVisibility(false)}>
            <EyeOff className="h-3.5 w-3.5 text-muted-foreground/70" />
            Esconder
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
