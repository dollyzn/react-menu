import { ChevronsUpDown, LayoutDashboard } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DensityOption } from ".";
import { cn } from "@/lib/utils";

interface DataTableDensityToggleProps {
  setDensity: (density: DensityOption) => void;
  currentDensity: DensityOption;
}

export function DataTableDensityToggle({
  setDensity,
  currentDensity,
}: DataTableDensityToggleProps) {
  const densityOptions = [
    {
      value: "spacious",
      label: "Espaçoso",
      description: "Mais espaço entre linhas",
    },
    {
      value: "comfortable",
      label: "Confortável",
      description: "Espaçamento padrão confortável",
    },
    {
      value: "default",
      label: "Padrão",
      description: "Espaçamento padrão do sistema",
    },
    {
      value: "compact",
      label: "Compacto",
      description: "Menos espaço entre linhas",
    },
    {
      value: "ultra-compact",
      label: "Ultra Compacto",
      description: "Mínimo espaço entre linhas",
    },
  ];

  const currentOption = densityOptions.find(
    (opt) => opt.value === currentDensity
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" size="sm" className="h-8" />}
      >
        <LayoutDashboard />
        <span className="sm:whitespace-nowrap">
          {currentOption?.label || "Densidade"}
        </span>
        <ChevronsUpDown className="ml-auto opacity-50" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Densidade da Tabela</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {densityOptions.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onClick={() => setDensity(option.value as DensityOption)}
              className={cn(
                "cursor-pointer",
                currentDensity === option.value && "bg-accent"
              )}
            >
              <div className="flex flex-col">
                <span>{option.label}</span>
                <span className="text-xs text-muted-foreground">
                  {option.description}
                </span>
              </div>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
