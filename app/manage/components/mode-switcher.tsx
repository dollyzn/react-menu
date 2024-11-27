"use client";

import { Moon, Sun, Monitor, Loader2 } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import {
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { DropdownMenuPortal } from "@radix-ui/react-dropdown-menu";

export function ModeSwitcher() {
  const { theme, setTheme } = useTheme();

  const currentTheme = theme;

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <div className="flex items-center gap-2">
          {mounted ? (
            <div>
              <Sun
                className={`h-5 w-5  ${
                  currentTheme === "light" ? "block" : "hidden"
                }`}
              />
              <Moon
                className={`h-5 w-5 ${
                  currentTheme === "dark" ? "block" : "hidden"
                }`}
              />
              <Monitor
                className={`h-5 w-5 ${
                  currentTheme === "system" ? "block" : "hidden"
                }`}
              />
            </div>
          ) : (
            <Loader2 className="h-5 w-5 animate-spin" />
          )}
          Tema
        </div>
      </DropdownMenuSubTrigger>
      <DropdownMenuPortal>
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
      </DropdownMenuPortal>
    </DropdownMenuSub>
  );
}
