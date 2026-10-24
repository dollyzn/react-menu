"use client";

import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Whole numbers with − / + (and typing): for small counts such as a choice
 * group's minimum and maximum. Clamps to [min, max].
 */
export function NumberStepper({
  id,
  value,
  onChange,
  min = 0,
  max = 99,
  label,
  disabled,
  invalid,
  className,
}: {
  id?: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  /** Names the buttons ("Diminuir mínimo"). */
  label: string;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
}) {
  const clamp = (next: number) => Math.min(max, Math.max(min, next));
  const current = Number.isFinite(value) ? value : min;
  return (
    <div className={cn("flex gap-2", className)}>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label={`Diminuir ${label}`}
        disabled={disabled || current <= min}
        onClick={() => onChange(clamp(current - 1))}
      >
        <Minus />
      </Button>
      <Input
        id={id}
        inputMode="numeric"
        aria-label={label}
        aria-invalid={invalid}
        disabled={disabled}
        value={Number.isFinite(value) ? value : ""}
        onChange={(event) => {
          const digits = event.target.value.replace(/\D/g, "");
          onChange(digits === "" ? Number.NaN : clamp(Number(digits)));
        }}
        onBlur={() => !Number.isFinite(value) && onChange(min)}
        className="min-w-0 flex-1 text-center font-semibold tabular-nums"
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label={`Aumentar ${label}`}
        disabled={disabled || current >= max}
        onClick={() => onChange(clamp(current + 1))}
      >
        <Plus />
      </Button>
    </div>
  );
}
