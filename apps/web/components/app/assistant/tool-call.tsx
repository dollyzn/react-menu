"use client";

import type { AssistantToolName } from "@react-menu/contracts";
import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockContent,
  CodeBlockCopyButton,
  CodeBlockHeader,
  CodeBlockLine,
  CodeBlockTitle,
} from "@/components/ui/code-block";
import { useHighlightedCode } from "@/hooks/use-highlighted-code";
import { formatCurrencyBRL } from "@/utils/string";

/** How each parameter reads, in the people's words. */
const PARAM_LABELS: Record<string, string> = {
  from: "De",
  to: "Até",
  compareFrom: "Comparar de",
  compareTo: "Comparar até",
  baseFrom: "Base de",
  baseTo: "Base até",
  days: "Dias à frente",
  query: "Busca",
  search: "Busca",
  category: "Categoria",
  status: "Status",
  number: "Pedido",
  date: "Dia",
  minutes: "Minutos",
  summary: "Resumo",
  itemId: "Item",
  ingredientId: "Insumo",
  type: "Tipo",
  quantity: "Quantidade",
  note: "Observação",
  name: "Nome",
  description: "Descrição",
  price: "Preço",
  isAvailable: "À venda",
  changes: "Alterações",
  categories: "Categorias",
  groupId: "Grupo",
  minChoices: "Mínimo",
  maxChoices: "Máximo",
  addOptions: "Opções que entram",
  removeOptions: "Opções que saem",
  copyFrom: "Cópia de",
  options: "Opções",
  itemIds: "Itens",
  replaceGroupId: "No lugar de",
  addGroupIds: "Grupos que entram",
  removeGroupIds: "Grupos que saem",
  addAddonIds: "Adicionais que entram",
  removeAddonIds: "Adicionais que saem",
};

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** A parameter's value for people: dates as 14/11/2026, prices in reais, yes/no. */
export function formatParam(key: string, value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string" && ISO_DAY.test(value)) {
    const [year, month, day] = value.split("-");
    return `${day}/${month}/${year}`;
  }
  if (typeof value === "boolean") return value ? "sim" : "não";
  if (typeof value === "number" && key === "price") return formatCurrencyBRL(value);
  if (key === "number" && typeof value === "number") return `#${value}`;
  if (Array.isArray(value)) return value.length === 1 ? "1 item" : `${value.length} itens`;
  if (typeof value === "object") return "…";
  return String(value);
}

/** JSON with syntax colors (Code Block), copyable. */
function JsonBlock({ title, value }: { title: string; value: unknown }) {
  const json = JSON.stringify(value, null, 2) ?? "";
  const lines = useHighlightedCode(json, "json");
  return (
    <CodeBlock size="sm">
      <CodeBlockHeader>
        <CodeBlockTitle>{title}</CodeBlockTitle>
        <CodeBlockActions>
          <CodeBlockCopyButton value={json} />
        </CodeBlockActions>
      </CodeBlockHeader>
      <CodeBlockContent className="max-h-56">
        {lines.map((line, index) => (
          <CodeBlockLine key={index}>{line}</CodeBlockLine>
        ))}
      </CodeBlockContent>
    </CodeBlock>
  );
}

/**
 * What a tool was called with and what it answered (the Tool pattern's
 * detail): the parameters in the people's words, then the raw answer.
 */
export function ToolCallDetails({
  name,
  input,
  output,
  errorText,
}: {
  name: AssistantToolName;
  input: unknown;
  output?: unknown;
  errorText?: string;
}) {
  const params = Object.entries((input ?? {}) as Record<string, unknown>);
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
        <dt className="text-muted-foreground">Ferramenta</dt>
        <dd className="font-mono">{name}</dd>
        {params.map(([key, value]) => (
          <div key={key} className="contents">
            <dt className="text-muted-foreground">{PARAM_LABELS[key] ?? key}</dt>
            <dd className="truncate">{formatParam(key, value)}</dd>
          </div>
        ))}
      </dl>
      {errorText ? (
        <p className="text-xs text-destructive">{errorText}</p>
      ) : output !== undefined ? (
        <JsonBlock title="Resposta do sistema" value={output} />
      ) : null}
    </div>
  );
}
