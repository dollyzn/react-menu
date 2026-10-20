"use client";

import { useEffect, useRef } from "react";
import { useMotionValue, useSpring } from "motion/react";
import { formatCurrencyBRL } from "@/utils/string";
import { cn } from "@/lib/utils";

/** A BRL amount that rolls to its new value (based on Magic UI's number ticker). */
export function AnimatedPrice({ value, className }: { value: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const motionValue = useMotionValue(value);
  const spring = useSpring(motionValue, { damping: 40, stiffness: 260 });

  useEffect(() => {
    motionValue.set(value);
  }, [motionValue, value]);

  useEffect(
    () =>
      spring.on("change", (latest) => {
        if (ref.current) ref.current.textContent = formatCurrencyBRL(Math.round(latest * 100) / 100);
      }),
    [spring]
  );

  return (
    <span ref={ref} className={cn("tabular-nums", className)}>
      {formatCurrencyBRL(value)}
    </span>
  );
}
