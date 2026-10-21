"use client";

import { createContext, useContext } from "react";
import { ClipboardCheck, History, MinusCircle, MoreHorizontal, Pencil, PlusCircle, Trash2 } from "lucide-react";
import type { Ingredient } from "@react-menu/contracts";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { MovementKind } from "../movement-dialog";

/** What the page does for a row; columns and cards stay static. */
export interface IngredientActions {
  move: (ingredient: Ingredient, kind: MovementKind) => void;
  edit: (ingredient: Ingredient) => void;
  history: (ingredient: Ingredient) => void;
  remove: (ingredient: Ingredient) => void;
}

export const IngredientActionsContext = createContext<IngredientActions | null>(null);

function useIngredientActions() {
  const actions = useContext(IngredientActionsContext);
  if (!actions) throw new Error("IngredientActionsContext missing");
  return actions;
}

type ButtonSize = React.ComponentProps<typeof Button>["size"];

/** Histórico / Editar / Excluir. */
export function IngredientMenu({ ingredient, size = "icon-sm" }: { ingredient: Ingredient; size?: ButtonSize }) {
  const actions = useIngredientActions();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size={size} aria-label={`Ações de ${ingredient.name}`} />}>
        <MoreHorizontal />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => actions.history(ingredient)}>
          <History /> Histórico
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => actions.edit(ingredient)}>
          <Pencil /> Editar
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => actions.remove(ingredient)}>
          <Trash2 /> Excluir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const MOVES: { kind: MovementKind; label: string; icon: typeof PlusCircle }[] = [
  { kind: "purchase", label: "Entrada", icon: PlusCircle },
  { kind: "waste", label: "Perda", icon: MinusCircle },
  { kind: "adjustment", label: "Contar", icon: ClipboardCheck },
];

/** Entrada / Perda / Contar: the everyday stock moves, one tap away. */
export function StockMoves({
  ingredient,
  size = "sm",
  className,
}: {
  ingredient: Ingredient;
  size?: ButtonSize;
  className?: string;
}) {
  const actions = useIngredientActions();
  return (
    <div className={cn("flex gap-1", className)}>
      {MOVES.map(({ kind, label, icon: Icon }) => (
        <Button
          key={kind}
          variant="outline"
          size={size}
          aria-label={`${label}: ${ingredient.name}`}
          onClick={() => actions.move(ingredient, kind)}
        >
          <Icon /> {label}
        </Button>
      ))}
    </div>
  );
}
