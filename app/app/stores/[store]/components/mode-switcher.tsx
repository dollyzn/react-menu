"use client";

import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "next-themes";
import {
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";

export function ModeSwitcher() {
  const { resolvedTheme, theme, setTheme } = useTheme();
  const currentTheme = theme === "system" ? "system" : (resolvedTheme ?? "light");

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <div className="flex items-center gap-2">
          <div>
            <Sun
              className={`h-5 w-5 ${currentTheme === "light" ? "block" : "hidden"}`}
            />
            <Moon
              className={`h-5 w-5 ${currentTheme === "dark" ? "block" : "hidden"}`}
            />
            <Monitor
              className={`h-5 w-5 ${currentTheme === "system" ? "block" : "hidden"}`}
            />
          </div>
          Tema
        </div>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        <DropdownMenuItem onClick={() => setTheme("light")}>
          <Sun className="mr-2 h-4 w-4" />
          <span>Claro</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          <Moon className="mr-2 h-4 w-4" />
          <span>Escuro</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>
          <Monitor className="mr-2 h-4 w-4" />
          <span>Automático</span>
        </DropdownMenuItem>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}
