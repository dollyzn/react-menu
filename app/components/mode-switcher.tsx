"use client";

import { Moon, Sun, SunMoon } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ModeSwitcher() {
  const { resolvedTheme, theme, setTheme } = useTheme();
  const currentTheme =
    theme === "system" ? "system" : (resolvedTheme ?? "light");

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger render={<Button variant="outline" size="icon" />}>
        <>
          <Sun
            className={`absolute h-5 w-5 transition-all ${
              currentTheme === "light"
                ? "opacity-100 scale-100"
                : "opacity-0 scale-0"
            }`}
          />
          <Moon
            className={`absolute h-5 w-5 transition-all ${
              currentTheme === "dark"
                ? "opacity-100 scale-100"
                : "opacity-0 scale-0"
            }`}
          />
          <SunMoon
            className={`absolute h-5 w-5 transition-all ${
              currentTheme === "system"
                ? "opacity-100 scale-100"
                : "opacity-0 scale-0"
            }`}
          />
        </>

        <span className="sr-only">Alternar tema</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>
          <Sun className="mr-2 h-4 w-4" />
          <span>Claro</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          <Moon className="mr-2 h-4 w-4" />
          <span>Escuro</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>
          <SunMoon className="mr-2 h-4 w-4" />
          <span>Automático</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
