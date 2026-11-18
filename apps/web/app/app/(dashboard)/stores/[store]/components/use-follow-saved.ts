"use client";

import { useEffect, useRef } from "react";
import type { FieldValues, UseFormReturn } from "react-hook-form";

/**
 * Keeps an untouched form in step with the saved store: when `version`
 * changes (the store's `updatedAt`, after any save on the page or elsewhere),
 * a form without edits takes the new values; one being edited keeps them.
 * Remounting the form with a `key` instead would throw the edits away.
 */
export function useFollowSaved<T extends FieldValues>(form: UseFormReturn<T>, saved: () => T, version: string) {
  const latest = useRef(saved);
  useEffect(() => {
    latest.current = saved;
  });
  useEffect(() => {
    if (!form.formState.isDirty) form.reset(latest.current());
  }, [form, version]);
}
