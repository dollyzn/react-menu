import { useState } from "react";
import { Rows3 } from "lucide-react";
import { Command, CommandGroup, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { DensityOption } from ".";
import { FilterOptionRow, ToolbarTrigger } from "./data-table-filter-parts";

/** Three rows drawn with the density's spacing, so the options read at a glance. */
function glyph(gap: string) {
  function DensityGlyph({ className }: { className?: string }) {
    return (
      <span aria-hidden className={cn("flex h-4 w-4 flex-col justify-center", gap, className)}>
        {[0, 1, 2].map((line) => (
          <span key={line} className="h-0.5 w-full rounded-full bg-current" />
        ))}
      </span>
    );
  }
  return DensityGlyph;
}

const OPTIONS: { value: DensityOption; label: string; description: string; icon: ReturnType<typeof glyph> }[] = [
  { value: "spacious", label: "Espaçoso", description: "Mais espaço e texto maior", icon: glyph("gap-[5px]") },
  { value: "comfortable", label: "Confortável", description: "Um pouco mais de respiro", icon: glyph("gap-1") },
  { value: "default", label: "Padrão", description: "O espaçamento do sistema", icon: glyph("gap-[3px]") },
  { value: "compact", label: "Compacto", description: "Mais linhas na tela", icon: glyph("gap-0.5") },
  { value: "ultra-compact", label: "Ultra compacto", description: "O máximo de linhas", icon: glyph("gap-px") },
];

interface DataTableDensityToggleProps {
  setDensity: (density: DensityOption) => void;
  currentDensity: DensityOption;
}

/** Row spacing of the table (kept per table in localStorage). */
export function DataTableDensityToggle({ setDensity, currentDensity }: DataTableDensityToggleProps) {
  const [open, setOpen] = useState(false);
  const current = OPTIONS.find((option) => option.value === currentDensity) ?? OPTIONS[2];
  const changed = current.value !== "default";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <ToolbarTrigger
        icon={Rows3}
        label="Densidade"
        summary={changed ? current.label : undefined}
        active={changed}
        ariaLabel={`Densidade das linhas: ${current.label}`}
      />
      <PopoverContent align="end" className="w-64 p-0" sideOffset={8}>
        <Command>
          <CommandList className="max-h-[min(28rem,60vh)]">
            <CommandGroup heading="Densidade das linhas">
              {OPTIONS.map((option) => (
                <FilterOptionRow
                  key={option.value}
                  value={option.value}
                  option={option}
                  multiple={false}
                  selected={option.value === current.value}
                  onSelect={() => {
                    setDensity(option.value);
                    setOpen(false);
                  }}
                />
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
