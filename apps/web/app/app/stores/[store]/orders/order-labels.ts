import { Globe, Store as StoreIcon, type LucideIcon } from "lucide-react";
import type { OrderChannel, OrderStatus, PaymentMethod } from "@react-menu/contracts";

/** Staff-facing status names and colors (board, history, detail). */
export const STATUS: Record<OrderStatus, { label: string; tone: string }> = {
  pending_payment: { label: "Aguardando pagamento", tone: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  received: { label: "Na fila", tone: "bg-sky-500/15 text-sky-700 dark:text-sky-300" },
  preparing: { label: "Em preparo", tone: "bg-primary/15 text-primary" },
  ready: { label: "Pronto", tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  completed: { label: "Entregue", tone: "bg-muted text-muted-foreground" },
  cancelled: { label: "Cancelado", tone: "bg-destructive/10 text-destructive" },
};

export const CHANNEL: Record<OrderChannel, { label: string; icon: LucideIcon }> = {
  online: { label: "Online", icon: Globe },
  pos: { label: "Balcão", icon: StoreIcon },
};

export const PAYMENT: Record<PaymentMethod, string> = {
  counter: "Na retirada",
  mercado_pago: "Mercado Pago",
};

export const toOptions = <K extends string>(record: Record<K, { label: string } | string>) =>
  (Object.keys(record) as K[]).map((value) => {
    const entry = record[value];
    return { value, label: typeof entry === "string" ? entry : entry.label };
  });
