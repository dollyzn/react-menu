"use client";

import { Radio } from "@base-ui/react/radio";
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group";
import { motion } from "motion/react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useHydrated } from "@/hooks/use-hydrated";
import { useThemeTransition, type ThemeChoice } from "@/hooks/use-theme-transition";
import { cn } from "@/lib/utils";

const OPTIONS: { value: ThemeChoice; label: string; icon: typeof Sun }[] = [
  { value: "system", label: "Automático", icon: Monitor },
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Escuro", icon: Moon },
];

/**
 * Compact theme switch (system / light / dark) with a sliding indicator and
 * the circular theme transition from the clicked button.
 */
export function ThemeSegmented({ className }: { className?: string }) {
  const hydrated = useHydrated();
  const { choice, change, originOfEvent } = useThemeTransition();
  // The saved choice is only known on the client.
  const current = hydrated ? choice : null;

  return (
    <RadioGroupPrimitive
      aria-label="Tema"
      value={current}
      onValueChange={(value, details) => change(value as ThemeChoice, originOfEvent(details.event))}
      className={cn("flex items-center rounded-full border bg-muted/40 p-0.5", className)}
    >
      {OPTIONS.map((option) => {
        const selected = current === option.value;
        return (
          <Radio.Root
            key={option.value}
            value={option.value}
            aria-label={option.label}
            title={option.label}
            className={cn(
              "relative flex size-5 items-center justify-center rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50",
              selected ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {selected && (
              <motion.span
                layoutId="theme-segmented-indicator"
                className="absolute inset-0 rounded-full bg-background shadow-sm ring-1 ring-border"
                transition={{ type: "spring", stiffness: 500, damping: 35 }}
              />
            )}
            <option.icon className="relative size-3" />
          </Radio.Root>
        );
      })}
    </RadioGroupPrimitive>
  );
}
