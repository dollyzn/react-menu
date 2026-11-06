import { useState } from "react";

/**
 * The value a dialog shows while it animates closed. Dialogs opened from a
 * piece of state (`open={Boolean(item)}`) lose their content the moment the
 * state is cleared, so the exit animation shows an empty or different dialog
 * (a flicker). Render from this instead: it keeps the last set value until
 * the next one replaces it.
 *
 *   const shown = useLastValue(item)
 *   <Dialog open={Boolean(item)}>…{shown?.name}…</Dialog>
 */
export function useLastValue<T>(value: T, isSet: (value: T) => boolean = (v) => v !== null && v !== undefined): T {
  const [last, setLast] = useState(value);
  // Updating state while rendering is React's pattern for "remember the
  // previous value" (no effect, no extra paint).
  if (isSet(value) && value !== last) setLast(value);
  return isSet(value) ? value : last;
}
