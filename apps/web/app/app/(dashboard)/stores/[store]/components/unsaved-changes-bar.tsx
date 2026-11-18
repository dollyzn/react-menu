"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button";

/**
 * Rises from the bottom of a form once something changed and stays in view
 * while the form scrolls (sticky): "Desfazer" and "Salvar" are always at hand.
 * Render it inside the `<form>` (the save button submits it).
 */
export function UnsavedChangesBar({
  dirty,
  busy,
  onReset,
  label = "Alterações não salvas",
}: {
  dirty: boolean;
  busy: boolean;
  onReset: () => void;
  label?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence initial={false}>
      {(dirty || busy) && (
        <motion.div
          key="bar"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
          transition={{ type: "spring", stiffness: 420, damping: 32 }}
          className="sticky bottom-4 z-10 mx-auto flex w-full max-w-xl flex-wrap items-center justify-between gap-3 rounded-2xl border bg-popover/95 p-2 pl-4 shadow-lg supports-backdrop-filter:backdrop-blur"
          role="region"
          aria-label={label}
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-warning opacity-60 motion-reduce:animate-none" />
              <span className="relative inline-flex size-2 rounded-full bg-warning" />
            </span>
            {label}
          </span>
          <span className="flex gap-2">
            <Button type="button" variant="ghost" disabled={busy} onClick={onReset}>
              Desfazer
            </Button>
            <Button type="submit" loading={busy}>
              Salvar
            </Button>
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
