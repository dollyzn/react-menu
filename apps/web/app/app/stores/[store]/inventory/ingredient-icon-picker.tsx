"use client";

import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/** Emoji the kitchen understands at a glance (same set the API suggests from). */
const ICONS: [string, string][] = [
  ["🥟", "Massa"], ["🧀", "Queijo"], ["🥩", "Carne"], ["🍖", "Presunto"], ["🍗", "Frango"],
  ["🌭", "Linguiça"], ["🥓", "Bacon"], ["🦐", "Camarão"], ["🐟", "Peixe"], ["🥚", "Ovo"],
  ["🌽", "Milho"], ["🍅", "Tomate"], ["🫒", "Azeitona"], ["🥦", "Brócolis"], ["🥬", "Folhas"],
  ["🌴", "Palmito"], ["🍆", "Berinjela"], ["🧅", "Cebola"], ["🧄", "Alho"], ["🫑", "Pimentão"],
  ["🌶️", "Pimenta"], ["🍄", "Cogumelo"], ["🌿", "Ervas"], ["🥫", "Molho"], ["🍫", "Chocolate"],
  ["🤍", "Chocolate branco"], ["🍯", "Doce de leite"], ["🥛", "Leite"], ["🍬", "Doce"], ["🍌", "Banana"],
  ["🍓", "Morango"], ["🥥", "Coco"], ["🍍", "Abacaxi"], ["🥤", "Refrigerante"], ["🧃", "Suco"], ["💧", "Água"],
];

/** `null` = automatic: the API suggests one from the name. */
export function IngredientIconPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (icon: string | null) => void;
}) {
  return (
    <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-10" role="radiogroup" aria-label="Ícone na cozinha">
      <button
        type="button"
        role="radio"
        aria-checked={value === null}
        aria-label="Automático (pelo nome)"
        title="Automático (pelo nome)"
        onClick={() => onChange(null)}
        className={cn(
          "flex aspect-square items-center justify-center rounded-lg border text-muted-foreground transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          value === null ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted"
        )}
      >
        <Sparkles className="size-4" />
      </button>
      {ICONS.map(([icon, label]) => (
        <button
          key={icon}
          type="button"
          role="radio"
          aria-checked={value === icon}
          aria-label={label}
          title={label}
          onClick={() => onChange(icon)}
          className={cn(
            "flex aspect-square items-center justify-center rounded-lg border font-emoji text-xl transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            value === icon ? "border-primary bg-primary/10" : "hover:bg-muted"
          )}
        >
          {icon}
        </button>
      ))}
    </div>
  );
}
