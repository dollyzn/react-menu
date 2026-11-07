"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { writeClipboard } from "@/utils/copy-to-clipboard";

/**
 * Copy with the confirmation on the button itself ("Copiado!" for 2 s)
 * instead of a toast over the screen; a failure still says so.
 */
export function useCopied() {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async (value: string) => {
    try {
      await writeClipboard(value);
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar.", { id: "copy-error" });
    }
  };
  return { copied, copy };
}
