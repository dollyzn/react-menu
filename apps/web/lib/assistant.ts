import type { UIMessage } from "ai";
import {
  Ban,
  Boxes,
  CalendarSearch,
  ChartNoAxesColumn,
  ClipboardList,
  HandCoins,
  LayoutDashboard,
  ListPlus,
  type LucideIcon,
  ListChecks,
  Package,
  PackagePlus,
  Pencil,
  Power,
  ReceiptText,
  Store,
  Timer,
  TrendingUp,
} from "lucide-react";
import type {
  AssistantApprovalPreview,
  AssistantMessageMetadata,
  AssistantProvider,
  AssistantToolName,
  AssistantTools,
  StoreRole,
} from "@react-menu/contracts";
import { compressImage } from "@/lib/image-compress";

/** The assistant's messages: metadata, the approval cards' data and the tools. */
export type AssistantUIMessage = UIMessage<
  AssistantMessageMetadata,
  { approval: AssistantApprovalPreview & { state?: unknown } },
  AssistantTools
>;
export type AssistantPart = AssistantUIMessage["parts"][number];
export type AssistantToolPart = Extract<AssistantPart, { type: `tool-${string}` }>;

export const isToolPart = (part: AssistantPart): part is AssistantToolPart => part.type.startsWith("tool-");
export const toolNameOf = (part: AssistantToolPart) => part.type.slice(5) as AssistantToolName;

/** How each tool reads in the steps: running, done, and its icon. */
export const TOOL_LABELS: Record<AssistantToolName, { running: string; done: string; icon: LucideIcon }> = {
  sales_summary: { running: "Consultando as vendas", done: "Consultou as vendas", icon: ChartNoAxesColumn },
  item_sales: { running: "Consultando as vendas do item", done: "Consultou as vendas do item", icon: TrendingUp },
  stock_forecast: { running: "Calculando o estoque", done: "Calculou o estoque", icon: Boxes },
  orders_now: { running: "Olhando o quadro de pedidos", done: "Olhou o quadro de pedidos", icon: ClipboardList },
  find_orders: { running: "Buscando no histórico", done: "Buscou no histórico", icon: CalendarSearch },
  pay_later_open: { running: "Consultando o fiado", done: "Consultou o fiado", icon: HandCoins },
  menu_items: { running: "Lendo o cardápio", done: "Leu o cardápio", icon: Package },
  update_items: { running: "Alterando itens", done: "Alterou itens", icon: Pencil },
  record_stock: { running: "Lançando no estoque", done: "Lançou no estoque", icon: PackagePlus },
  create_menu_items: { running: "Criando itens", done: "Criou itens", icon: ListPlus },
  store_status: { running: "Vendo se a loja está aberta", done: "Viu a situação da loja", icon: Store },
  today_overview: { running: "Olhando o dia de hoje", done: "Olhou o dia de hoje", icon: LayoutDashboard },
  order_details: { running: "Abrindo o pedido", done: "Abriu o pedido", icon: ReceiptText },
  update_item_details: { running: "Alterando o item", done: "Alterou o item", icon: Pencil },
  option_groups: { running: "Lendo os grupos de escolha", done: "Leu os grupos de escolha", icon: ListChecks },
  update_option_group: { running: "Alterando o grupo", done: "Alterou o grupo", icon: ListChecks },
  create_option_group: { running: "Criando o grupo", done: "Criou o grupo", icon: ListChecks },
  update_item_extras: { running: "Mudando os extras dos itens", done: "Mudou os extras dos itens", icon: ListChecks },
  set_store_status: { running: "Mudando o status da loja", done: "Mudou o status da loja", icon: Power },
  set_pickup_time: { running: "Mudando o tempo de retirada", done: "Mudou o tempo de retirada", icon: Timer },
  cancel_order: { running: "Cancelando o pedido", done: "Cancelou o pedido", icon: Ban },
};

/** The panel screen of a path (`/app/stores/:id/reports` → "Relatórios"), for the assistant's context. */
const PAGES: Record<string, string> = {
  "": "Loja",
  overview: "Visão geral",
  orders: "Pedidos",
  pos: "PDV",
  kitchen: "Cozinha",
  categories: "Categorias",
  items: "Itens",
  addons: "Adicionais",
  "option-groups": "Grupos de escolha",
  inventory: "Estoque",
  reports: "Relatórios",
  members: "Equipe",
};

export function pageOf(pathname: string) {
  const match = pathname.match(/\/app\/stores\/[^/]+\/?([^/?#]*)/);
  return match ? (PAGES[match[1]] ?? null) : null;
}

/** Questions per screen; managers see these, attendants only theirs (`ATTENDANT`). */
const BY_PAGE: Record<string, string[]> = {
  Relatórios: [
    "Como foram as vendas desta semana comparadas à anterior?",
    "Qual o horário de pico de sábado?",
    "Qual item mais cresceu este mês?",
    "Quanto vendi no último fim de semana?",
    "Qual dia da semana vende mais?",
  ],
  "Visão geral": ["Como está o dia até agora?", "O que mais vendeu hoje?", "Hoje está melhor que a semana passada?"],
  Estoque: [
    "O que pode acabar no sábado?",
    "Quais insumos estão abaixo do mínimo?",
    "Quanto preciso comprar para o fim de semana?",
  ],
  Itens: [
    "Quais itens estão pausados?",
    "Aumenta R$ 1 em todos os pastéis doces",
    "Escreve descrições para os itens sem descrição",
    "Quais itens venderam menos este mês?",
  ],
  Categorias: ["Quais categorias vendem mais?", "Quais itens estão pausados?"],
  Adicionais: ["Quais adicionais mais vendem?", "Quais itens oferecem bacon?"],
  "Grupos de escolha": [
    "Quais grupos de escolha cada pastel usa?",
    "Deixa o queijo opcional nos pastéis Premium",
    "Coloca os opcionais (orégano e alho) nas tirinhas",
  ],
  Pedidos: [
    "Tem pedido atrasado agora?",
    "Quem está com fiado em aberto?",
    "Aumenta o tempo de retirada para 30 minutos",
    "Quais pedidos estão prontos?",
  ],
  Loja: ["A loja está aberta?", "Fecha a loja agora", "Qual o tempo de retirada agora?"],
  PDV: ["Tem pedido atrasado agora?", "Quais itens estão pausados?", "A loja está aberta?"],
};

const MANAGER_GENERAL = [
  "Como está o dia até agora?",
  "Quanto vendi nos últimos 7 dias?",
  "O que pode acabar no sábado?",
  "Quem está com fiado em aberto?",
  "Tem pedido atrasado agora?",
  "Quais itens mais venderam no mês?",
  "Qual o horário de pico de sábado?",
  "Quais insumos estão abaixo do mínimo?",
  "Quais itens estão pausados?",
  "Quais grupos de escolha cada pastel usa?",
];

/** Attendants: what their tools answer (orders now, the menu, whether it's open). */
const ATTENDANT = [
  "Tem pedido atrasado agora?",
  "Quais pedidos estão prontos?",
  "A loja está aberta?",
  "Quais itens estão pausados?",
  "Quais sabores de pastel doce temos?",
  "Qual o preço do pastel de carne?",
];

/** A stable shuffle (the same seed, the same order: no reshuffle on every render). */
function shuffled<T>(list: T[], seed: number) {
  const rows = [...list];
  let state = Math.floor(seed * 2 ** 31) || 1;
  for (let index = rows.length - 1; index > 0; index--) {
    state = (state * 48271) % 2147483647;
    const other = state % (index + 1);
    [rows[index], rows[other]] = [rows[other], rows[index]];
  }
  return rows;
}

/**
 * One-tap questions for the screen the person is on: the screen's first,
 * then a varied pick of the rest (`seed` fixes the pick for a conversation).
 */
export function suggestionsFor(page: string | null, role: StoreRole | null, seed = 0): string[] {
  if (role !== "manager") return shuffled(ATTENDANT, seed).slice(0, 5);
  const forPage = shuffled((page && BY_PAGE[page]) || [], seed).slice(0, 3);
  return [...new Set([...forPage, ...shuffled(MANAGER_GENERAL, seed + 0.5)])].slice(0, 6);
}

export const PROVIDERS: { value: AssistantProvider; label: string; keyHint: string; keyUrl: string }[] = [
  { value: "anthropic", label: "Claude (Anthropic)", keyHint: "sk-ant-…", keyUrl: "https://console.anthropic.com/settings/keys" },
  { value: "openai", label: "ChatGPT (OpenAI)", keyHint: "sk-…", keyUrl: "https://platform.openai.com/api-keys" },
  { value: "google", label: "Gemini (Google)", keyHint: "AIza…", keyUrl: "https://aistudio.google.com/apikey" },
];

/**
 * Recommended models per provider; the settings also list what the store's
 * key can use (asked to the provider), and any other id can be typed.
 */
export const MODEL_SUGGESTIONS: Record<AssistantProvider, { id: string; name: string; note: string }[]> = {
  anthropic: [
    { id: "claude-opus-5-5", name: "Claude Opus 5.5", note: "Mais capaz" },
    { id: "claude-sonnet-5-5", name: "Claude Sonnet 5.5", note: "Equilíbrio entre qualidade e custo" },
    { id: "claude-haiku-5-5", name: "Claude Haiku 5.5", note: "Mais rápido e barato" },
  ],
  openai: [
    { id: "gpt-6.2-sol", name: "GPT-6.2 Sol", note: "Equilíbrio entre qualidade e custo" },
    { id: "gpt-6.1-terra", name: "GPT-6.1 Terra", note: "Bom e mais barato" },
    { id: "gpt-6-luna", name: "GPT-6 Luna", note: "Mais rápido e barato" },
  ],
  google: [
    { id: "gemini-3.8-flash", name: "Gemini 3.8 Flash", note: "Equilíbrio entre qualidade e custo" },
    { id: "gemini-4-hydrogen", name: "Gemini 4 Hydrogen", note: "Geração 4, preço intermediário" },
    { id: "gemini-3.5-flash-lite", name: "Gemini 3.5 Flash-Lite", note: "Mais rápido e barato" },
  ],
};

/** The API's message out of an RTK Query error (`data.message`). */
export function apiErrorText(error: unknown) {
  const data = (error as { data?: { message?: string } } | undefined)?.data;
  return data?.message ?? "Não foi possível falar com o provedor. Tente de novo.";
}

/** A photo for the assistant: resized like menu photos, as a data URL (the API keeps it in the conversation). */
export async function photoPart(file: File) {
  const blob = await compressImage(file, { maxSide: 1568 });
  const url = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
  return { type: "file" as const, mediaType: blob.type, url, filename: file.name };
}

/** The API's message out of a failed chat request (its body is the JSON error). */
export function chatErrorText(error: Error | undefined) {
  if (!error) return null;
  try {
    const body = JSON.parse(error.message) as { message?: string; code?: string };
    if (body.message) return body.message;
  } catch {
    // Not JSON: a network failure.
  }
  return /fetch|network/i.test(error.message)
    ? "Sem conexão com o servidor. Verifique a internet e tente de novo."
    : "Algo deu errado. Tente de novo.";
}

/** What the panel remembers per person and store on this browser: model, mode and the open conversation. */
export type AssistantPrefs = { model?: string | null; effort?: "fast" | "deep"; conversationId?: string | null };

/** `scope` is `<userId>:<storeId>`. */
const prefsKey = (scope: string) => `assistant:${scope}`;

export function readAssistantPrefs(scope: string): AssistantPrefs {
  try {
    return JSON.parse(window.localStorage.getItem(prefsKey(scope)) ?? "{}") as AssistantPrefs;
  } catch {
    return {};
  }
}

export function writeAssistantPrefs(scope: string, patch: AssistantPrefs) {
  try {
    window.localStorage.setItem(prefsKey(scope), JSON.stringify({ ...readAssistantPrefs(scope), ...patch }));
  } catch {
    // Private mode or full storage: the choice lasts until the page reloads.
  }
}
