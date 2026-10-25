"use client";

import { Radio } from "@base-ui/react/radio";
import { Sparkles } from "lucide-react";
import { RadioGroup } from "@/components/ui/radio-group";
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

const AUTO = "auto";

const tile =
  "flex aspect-square items-center justify-center rounded-lg border transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 data-checked:border-primary data-checked:bg-primary/10";

/**
 * `null` = automatic: the API suggests one from the name. One tab stop for
 * the whole grid; arrow keys move between icons (radio group).
 */
export function IngredientIconPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (icon: string | null) => void;
}) {
  return (
    <RadioGroup
      aria-label="Ícone na cozinha"
      value={value ?? AUTO}
      onValueChange={(next) => onChange(next === AUTO ? null : (next as string))}
      className="grid-cols-8 gap-1.5 sm:grid-cols-10"
    >
      <Radio.Root
        value={AUTO}
        aria-label="Automático (pelo nome)"
        title="Automático (pelo nome)"
        className={cn(tile, "text-muted-foreground data-checked:text-primary")}
      >
        <Sparkles className="size-4" />
      </Radio.Root>
      {ICONS.map(([icon, label]) => (
        <Radio.Root key={icon} value={icon} aria-label={label} title={label} className={cn(tile, "font-emoji text-xl")}>
          {icon}
        </Radio.Root>
      ))}
    </RadioGroup>
  );
}
