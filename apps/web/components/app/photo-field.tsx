"use client";

import { useEffect, useEffectEvent, useId, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ImageOff, ImagePlus, RefreshCw, Trash2, Undo2, Upload } from "lucide-react";
import Image from "@/components/app/image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { compressImage, ImageCompressError } from "@/lib/image-compress";
import { cn } from "@/lib/utils";
import { formatCurrencyBRL } from "@/utils/string";

/** What the form will do with the photo on save. */
export type PhotoChange =
  | { kind: "keep" }
  | { kind: "new"; blob: Blob; preview: string }
  | { kind: "remove" };

export const KEEP_PHOTO: PhotoChange = { kind: "keep" };

const isEditable = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

/**
 * A menu photo: drop it, paste it (Ctrl+V), pick it or take it with the
 * phone's camera. It is shrunk in the browser (`lib/image-compress.ts`) and
 * only sent when the form is saved; "Desfazer" goes back to the saved photo.
 * Shows it the way the customer sees it: the 16:10 detail and the list's
 * square thumbnail.
 */
export function PhotoField({
  currentUrl,
  value,
  onChange,
  disabled,
  name,
  price,
}: {
  /** The saved photo (null: none yet). */
  currentUrl: string | null;
  value: PhotoChange;
  onChange: (value: PhotoChange) => void;
  disabled?: boolean;
  /** For the menu preview. */
  name?: string;
  price?: number;
}) {
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const reduceMotion = useReducedMotion();
  const [dragDepth, setDragDepth] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shown = value.kind === "new" ? value.preview : value.kind === "remove" ? null : currentUrl;
  const dragging = dragDepth > 0 && !disabled;

  // Object URLs of staged photos are freed when replaced or unmounted.
  const preview = value.kind === "new" ? value.preview : null;
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const take = async (file: File | undefined) => {
    if (!file || disabled) return;
    setError(null);
    setProcessing(true);
    try {
      const blob = await compressImage(file);
      onChange({ kind: "new", blob, preview: URL.createObjectURL(blob) });
    } catch (err) {
      setError(err instanceof ImageCompressError ? err.message : "Não foi possível usar esta imagem.");
    } finally {
      setProcessing(false);
      if (input.current) input.current.value = "";
    }
  };

  // Pasting an image anywhere in the dialog (not into a text field) uses it.
  const onPaste = useEffectEvent((event: ClipboardEvent) => {
    if (disabled || isEditable(event.target)) return;
    const file = [...(event.clipboardData?.files ?? [])].find((item) => item.type.startsWith("image/"));
    if (!file) return;
    event.preventDefault();
    void take(file);
  });
  useEffect(() => {
    const listener = (event: ClipboardEvent) => onPaste(event);
    window.addEventListener("paste", listener);
    return () => window.removeEventListener("paste", listener);
  }, []);

  const pick = () => input.current?.click();
  const fade = reduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, scale: 1.04, filter: "blur(8px)" },
        animate: { opacity: 1, scale: 1, filter: "blur(0px)" },
        exit: { opacity: 0, scale: 0.98, filter: "blur(4px)" },
      };

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={input}
        id={inputId}
        type="file"
        // Phones offer the camera and the gallery for image/*.
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => void take(event.target.files?.[0])}
      />

      {/* Dragging highlights inside the frame (inset ring), never scales it: it would spill past the dialog. */}
      <div
        onDragEnter={(event) => {
          event.preventDefault();
          setDragDepth((depth) => depth + 1);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setDragDepth((depth) => Math.max(0, depth - 1))}
        onDrop={(event) => {
          event.preventDefault();
          setDragDepth(0);
          void take([...event.dataTransfer.files].find((file) => file.type.startsWith("image/")));
        }}
        className={cn(
          "group relative aspect-16/10 w-full overflow-hidden rounded-xl border bg-muted/40 transition-colors",
          !shown && "border-dashed",
          dragging && "border-primary bg-primary/5 ring-2 ring-primary/40 ring-inset",
          error && !dragging && "border-destructive/60"
        )}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          {shown ? (
            <motion.div key={shown} className="absolute inset-0" transition={{ duration: 0.35, ease: "easeOut" }} {...fade}>
              <Image
                src={shown}
                alt={name ? `Foto de ${name}` : "Foto do item"}
                fill
                sizes="(max-width: 640px) 100vw, 448px"
                unoptimized={shown.startsWith("blob:") || undefined}
                className="object-cover"
              />
            </motion.div>
          ) : (
            <motion.button
              key="empty"
              type="button"
              onClick={pick}
              disabled={disabled}
              className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed"
              transition={{ duration: 0.25 }}
              {...fade}
            >
              <motion.span
                animate={reduceMotion ? undefined : dragging ? { y: -4, scale: 1.1 } : { y: [0, -3, 0] }}
                transition={dragging ? { type: "spring", stiffness: 400 } : { duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary"
              >
                {dragging ? <Upload className="size-5" /> : <ImagePlus className="size-5" />}
              </motion.span>
              <span className="text-sm font-medium">
                {dragging ? "Solte para usar esta foto" : "Adicionar foto"}
              </span>
              <span className="max-w-xs text-xs text-muted-foreground">
                Arraste, cole (Ctrl+V) ou toque para escolher ou tirar uma foto. Ela fica leve sozinha.
              </span>
            </motion.button>
          )}
        </AnimatePresence>

        {/* Dropping over a photo replaces it. */}
        <AnimatePresence>
          {dragging && shown && (
            <motion.div
              key="drop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center gap-2 bg-background/70 text-sm font-medium backdrop-blur-sm"
            >
              <Upload className="size-4 text-primary" /> Solte para trocar
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {processing && (
            <motion.div
              key="processing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center gap-2 bg-background/60 text-sm font-medium backdrop-blur-sm"
              aria-live="polite"
            >
              <Spinner aria-hidden /> Preparando a foto…
            </motion.div>
          )}
        </AnimatePresence>

        {shown && !processing && (
          <>
            {value.kind === "new" && (
              <Badge className="absolute top-2 left-2 shadow-sm">Nova</Badge>
            )}
            <div className="absolute right-2 bottom-2 flex gap-1.5 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
              <Button type="button" size="sm" variant="secondary" className="shadow-sm" onClick={pick} disabled={disabled}>
                <RefreshCw data-icon="inline-start" /> Trocar
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="shadow-sm"
                aria-label="Remover foto"
                onClick={() => onChange(currentUrl ? { kind: "remove" } : KEEP_PHOTO)}
                disabled={disabled}
              >
                <Trash2 />
              </Button>
            </div>
          </>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* The list's square thumbnail, as the customer will see it. */}
        <div className="relative size-12 shrink-0 overflow-hidden rounded-lg border bg-muted">
          {shown ? (
            <Image src={shown} alt="" fill sizes="48px" unoptimized={shown.startsWith("blob:") || undefined} className="object-cover" />
          ) : (
            <ImageOff className="absolute top-1/2 left-1/2 size-4 -translate-1/2 text-muted-foreground/60" />
          )}
        </div>
        <div className="min-w-0 flex-1 text-xs text-muted-foreground" aria-live="polite">
          {error ? (
            <span className="text-destructive">{error}</span>
          ) : value.kind === "remove" ? (
            "A foto será removida ao salvar."
          ) : value.kind === "new" ? (
            <>
              Nova foto pronta ({Math.max(1, Math.round(value.blob.size / 1024))} KB). Enviada ao salvar.
            </>
          ) : (
            <>
              <span className="block truncate font-medium text-foreground">{name || "Seu item"}</span>
              {price ? formatCurrencyBRL(price) : "Assim aparece na lista do cardápio."}
            </>
          )}
        </div>
        <AnimatePresence>
          {value.kind !== "keep" && (
            <motion.div initial={{ opacity: 0, x: 6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 6 }}>
              <Button type="button" size="sm" variant="ghost" onClick={() => onChange(KEEP_PHOTO)} disabled={disabled}>
                <Undo2 data-icon="inline-start" /> Desfazer
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
