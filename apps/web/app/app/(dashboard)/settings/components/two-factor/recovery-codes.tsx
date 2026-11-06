"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { Check, Copy, Download, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

/**
 * The recovery codes, shown once: copy or download them, and confirm they
 * are kept before going on.
 */
export function RecoveryCodes({
  codes,
  kept,
  onKeptChange,
  onDone,
}: {
  codes: string[];
  /** "Guardei": the dialog holding the codes doesn't close before it. */
  kept: boolean;
  onKeptChange: (kept: boolean) => void;
  onDone: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const text = `React Menu: códigos de recuperação\nCada código entra uma vez, no lugar do app autenticador.\n\n${codes.join("\n")}\n`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      setCopied(true);
      toast.success("Códigos copiados");
    } catch {
      toast.error("Não foi possível copiar. Baixe o arquivo.");
    }
  };

  const download = () => {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "react-menu-codigos-de-recuperacao.txt";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-2.5 rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm">
        <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
        <p className="text-muted-foreground">
          <strong className="text-foreground">Guarde agora: eles não aparecem de novo.</strong> Sem o celular, cada
          código entra uma vez no lugar do app. Deixe-os longe do celular (no gerenciador de senhas, por exemplo).
        </p>
      </div>
      <ol aria-label="Códigos de recuperação" className="grid grid-cols-2 gap-2 rounded-xl border bg-muted/40 p-3">
        {codes.map((code, index) => (
          <motion.li
            key={code}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.03 }}
            className="flex items-center gap-2 rounded-md bg-background px-2 py-1.5 font-mono text-sm tracking-wider"
          >
            <span aria-hidden className="w-4 text-right text-xs text-muted-foreground tabular-nums">
              {index + 1}
            </span>
            <span className="flex-1 text-center">{code}</span>
          </motion.li>
        ))}
      </ol>
      <div className="flex gap-2">
        <Button type="button" variant="outline" className="flex-1" onClick={() => void copy()}>
          {copied ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />} Copiar
        </Button>
        <Button type="button" variant="outline" className="flex-1" onClick={download}>
          <Download data-icon="inline-start" /> Baixar .txt
        </Button>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={kept} onCheckedChange={(checked) => onKeptChange(Boolean(checked))} />
        Guardei meus códigos de recuperação
      </label>
      <Button type="button" onClick={onDone} disabled={!kept}>
        Concluir
      </Button>
    </div>
  );
}
