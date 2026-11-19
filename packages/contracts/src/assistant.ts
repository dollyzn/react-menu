import type { StoreStatus } from './entities.ts';
import type {
  IngredientUnit,
  OrderChannel,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  StockMovementType,
} from './orders.ts';
import type { DashboardToday } from './reports.ts';

/**
 * Store assistant (`/stores/:id/assistant`). The chat itself streams the AI
 * SDK's UI message protocol; these are the JSON endpoints around it and the
 * outputs of its tools, which the panel draws as cards.
 */

/** Where a store's models run, each with the store's own API key. */
export type AssistantProvider = 'anthropic' | 'openai' | 'google';

/** A model the store offers in the chat. */
export interface AssistantModelChoice {
  /** "openai:gpt-6.2-sol" (provider and the provider's model id). */
  id: string;
  provider: AssistantProvider;
  model: string;
  /** How the panel names it ("GPT-5"). */
  name: string;
  /** Input tokens the model takes, when the provider says (null: unknown). */
  contextWindow: number | null;
  /** The store's own price for the cost estimate (null: the list price). */
  pricing?: AssistantModelPricing | null;
}

/** US$ per million tokens. */
export interface AssistantModelPricing {
  input: number;
  /** Input read from the provider's cache. */
  cachedInput: number;
  output: number;
}

/**
 * `GET /stores/:id/assistant/costs` (managers): estimated US$ today and this
 * month (business days), per model, from the tokens used and each model's
 * price (the store's, or the list price; null when unknown).
 */
export interface AssistantCosts {
  today: AssistantCostPeriod;
  month: AssistantCostPeriod;
  /** Every model offered in the chat, with the price used. */
  prices: { id: string; pricing: AssistantModelPricing | null; custom: boolean }[];
}

export interface AssistantCostPeriod {
  /** Sum of the models with a price (US$). */
  total: number;
  /** Some usage had no price: the total is short. */
  partial: boolean;
  models: {
    /** "openai:gpt-6.2-sol" (also models no longer offered). */
    id: string;
    requests: number;
    tokens: AssistantTokens;
    /** US$, null without a price. */
    cost: number | null;
  }[];
}

/** The store's assistant setup (keys are never sent back: only which providers have one). */
export interface AssistantSettings {
  enabled: boolean;
  providers: AssistantProvider[];
  models: AssistantModelChoice[];
  defaultModel: string | null;
}

/**
 * `PUT /stores/:id/assistant-settings` (managers). Keys: a value saves it,
 * null removes it (and the models of that provider), left out keeps it.
 * `models` replaces the list offered in the chat; `defaultModel` must be one
 * of them.
 */
export interface AssistantSettingsInput {
  keys?: Partial<Record<AssistantProvider, string | null>>;
  models?: Omit<AssistantModelChoice, 'id'>[];
  defaultModel?: string | null;
}

/**
 * `POST /stores/:id/assistant-settings/models` (managers): the chat models
 * a key can use, asked to the provider (the key sent, or the saved one).
 */
export interface AssistantModelsInput {
  provider: AssistantProvider;
  apiKey?: string;
}

export interface AssistantModelOption {
  id: string;
  /** The provider's name for it ("Claude Opus 5.5"). */
  name: string;
  contextWindow: number | null;
}

/** "Rápido" answers with less thinking; "Detalhado" thinks more (slower, costs more). */
export type AssistantEffort = 'fast' | 'deep';

/** `GET /stores/:id/assistant` */
export interface AssistantStatus {
  /** False until a manager sets a model up: the panel offers the settings instead. */
  enabled: boolean;
  /** The models offered in the chat, and the one it starts with. */
  models: AssistantModelChoice[];
  defaultModel: string | null;
  /** Messages the store sent today (business day) and the daily limit. */
  usage: AssistantUsage;
}

export interface AssistantUsage {
  used: number;
  limit: number;
  /** Tokens the store used today, all models (input includes cached input). */
  tokens?: AssistantTokens;
}

export interface AssistantTokens {
  input: number;
  output: number;
  reasoning: number;
  cachedInput: number;
}

/** `GET /stores/:id/assistant/conversations`: your own, newest first. */
export interface AssistantConversationSummary {
  id: string;
  title: string | null;
  updatedAt: string;
}

/** `GET /stores/:id/assistant/conversations/:id`: `messages` are AI SDK UI messages. */
export interface AssistantConversationDetail extends AssistantConversationSummary {
  messages: unknown[];
}

/** Metadata of each assistant message. */
export interface AssistantMessageMetadata {
  usage?: AssistantUsage;
  /** The model that answered ("openai:gpt-6.2-sol"). */
  model?: string;
  /** Tokens of this answer (every model call of it). */
  tokens?: AssistantTokens;
  /** Input tokens of the last model call: how much of the context the conversation fills. */
  contextTokens?: number;
  /** How long each thought took, in milliseconds, in the order of the message's reasoning parts. */
  reasoningMs?: number[];
}

/** Names of the tools, as the UI parts carry them (`tool-<name>`). */
export type AssistantToolName = keyof AssistantTools;

/** Input and output of every tool, keyed by name (the shape the AI SDK's UIMessage takes). */
export type AssistantTools = {
  sales_summary: { input: { from: string; to: string }; output: AssistantSalesSummary };
  item_sales: {
    input: { query: string; from: string; to: string; compareFrom?: string; compareTo?: string };
    output: AssistantItemSales;
  };
  stock_forecast: {
    input: { baseFrom: string; baseTo: string; days: number };
    output: AssistantStockForecast;
  };
  orders_now: { input: Record<string, never>; output: AssistantOrdersNow };
  find_orders: {
    input: { from: string; to: string; search?: string; status?: OrderStatus[] };
    output: AssistantFoundOrders;
  };
  pay_later_open: { input: Record<string, never>; output: AssistantPayLater };
  menu_items: { input: { search?: string; category?: string }; output: AssistantMenuItems };
  update_items: {
    input: { changes: { itemId: string; price?: number; isAvailable?: boolean }[]; summary: string };
    output: { updated: number };
  };
  record_stock: {
    input: { ingredientId: number; type: 'purchase' | 'waste' | 'adjustment'; quantity: number; note?: string };
    output: { name: string; unit: IngredientUnit; stockQuantity: number };
  };
  store_status: { input: Record<string, never>; output: AssistantStoreStatus };
  today_overview: { input: Record<string, never>; output: Omit<DashboardToday, 'pace'> };
  order_details: { input: { number: number; date?: string }; output: AssistantOrderDetails };
  update_item_details: {
    input: { itemId: string; name?: string; description?: string | null };
    output: { name: string; description: string | null };
  };
  set_store_status: {
    input: { status: StoreStatus };
    output: { status: StoreStatus; isOpen: boolean; closesAt: string | null; opensAt: string | null };
  };
  set_pickup_time: { input: { minutes: number }; output: { pickupEtaMinutes: number } };
  cancel_order: {
    input: { number: number; date?: string };
    output: { number: number; status: OrderStatus; refunding: boolean };
  };
  create_menu_items: {
    input: {
      categories: { name: string; items: { name: string; price: number; description?: string }[] }[];
    };
    output: { categories: number; items: number };
  };
};

export interface AssistantSalesSummary {
  period: { from: string; to: string; days: number };
  previousPeriod: { from: string; to: string };
  summary: {
    revenue: number;
    orders: number;
    averageTicket: number;
    units: number;
    cancelled: { orders: number; value: number };
    previous: { orders: number; revenue: number };
  };
  /** Every day of the period, up to 62 days (null for longer periods). */
  daily: { date: string; orders: number; revenue: number }[] | null;
  /** Only the hours with orders. */
  hourly: { hour: number; orders: number }[];
  topItems: { name: string; quantity: number; revenue: number }[];
  topAddons: { name: string; quantity: number; revenue: number }[];
  payments: { method: PaymentMethod; paid: boolean; orders: number; revenue: number }[];
  channels: { channel: OrderChannel; orders: number; revenue: number }[];
}

export interface AssistantItemSalesPeriod {
  from: string;
  to: string;
  units: number;
  revenue: number;
  daily: { date: string; units: number; revenue: number }[];
}

export interface AssistantItemSales {
  query: string;
  /** Item names (as sold) that matched the search. */
  matches: string[];
  period: AssistantItemSalesPeriod;
  comparison: AssistantItemSalesPeriod | null;
}

export type AssistantStockStatus = 'out' | 'short' | 'low' | 'ok';

export interface AssistantStockForecast {
  /** False when the store doesn't track stock: nothing else is filled. */
  enabled: boolean;
  base: { from: string; to: string; days: number };
  /** Days ahead the forecast covers. */
  days: number;
  ingredients: {
    id: number;
    name: string;
    unit: IngredientUnit;
    icon: string | null;
    stock: number;
    minStock: number;
    /** Average a day in the base period. */
    dailyUse: number;
    /** What `days` days like the base period would take. */
    need: number;
    status: AssistantStockStatus;
  }[];
}

export interface AssistantOrdersNow {
  /** The store's usual pickup time, in minutes: older open orders are late. */
  etaMinutes: number;
  counts: Partial<Record<OrderStatus, number>>;
  orders: {
    id: string;
    number: number;
    customerName: string;
    status: OrderStatus;
    channel: OrderChannel;
    minutes: number;
    late: boolean;
    items: string;
    amountDue: number;
  }[];
}

export interface AssistantFoundOrders {
  total: number;
  orders: {
    id: string;
    number: number;
    date: string;
    customerName: string;
    status: OrderStatus;
    channel: OrderChannel;
    paymentMethod: PaymentMethod;
    total: number;
    items: string;
  }[];
}

export interface AssistantPayLater {
  count: number;
  total: number;
  debtors: {
    name: string;
    /** Last digits only ("•• 4521"): the full number stays in the panel. */
    phone: string | null;
    orders: number;
    due: number;
  }[];
}

export interface AssistantMenuItems {
  /** True when the store tracks stock (`stockLeft` is filled for items with a recipe). */
  inventory: boolean;
  items: {
    id: string;
    name: string;
    category: string;
    price: number;
    isAvailable: boolean;
    stockLeft: number | null;
  }[];
}

export interface AssistantStoreStatus {
  status: StoreStatus;
  /** Taking online orders right now (status, schedule and "closed until"). */
  isOpen: boolean;
  closesAt: string | null;
  opensAt: string | null;
  scheduleEnabled: boolean;
  pickupEtaMinutes: number;
}

export interface AssistantOrderDetails {
  id: string;
  number: number;
  date: string;
  customerName: string;
  /** Last digits only. */
  customerPhone: string | null;
  status: OrderStatus;
  channel: OrderChannel;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  payLater: boolean;
  total: number;
  amountPaid: number;
  amountDue: number;
  notes: string | null;
  createdAt: string;
  lines: { name: string; quantity: number; total: number; addons: string[]; notes: string | null }[];
  history: { status: OrderStatus; at: string }[];
}

/**
 * Shown with a write that waits for approval (`data-approval` part, keyed by
 * the tool call): what will change, from the database.
 */
export type AssistantApprovalPreview =
  | {
      kind: 'update_items';
      toolCallId: string;
      summary: string;
      rows: {
        itemId: string;
        name: string;
        before: { price: number; isAvailable: boolean };
        after: { price: number; isAvailable: boolean };
      }[];
    }
  | {
      kind: 'record_stock';
      toolCallId: string;
      name: string;
      unit: IngredientUnit;
      type: Extract<StockMovementType, 'purchase' | 'waste' | 'adjustment'>;
      quantity: number;
      before: number;
      after: number;
      note: string | null;
    }
  | {
      kind: 'store_status';
      toolCallId: string;
      before: { status: StoreStatus; isOpen: boolean };
      status: StoreStatus;
      scheduleEnabled: boolean;
    }
  | { kind: 'pickup_time'; toolCallId: string; before: number; after: number }
  | {
      kind: 'cancel_order';
      toolCallId: string;
      number: number;
      customerName: string;
      status: OrderStatus;
      total: number;
      amountPaid: number;
      items: string;
    }
  | {
      kind: 'item_details';
      toolCallId: string;
      before: { name: string; description: string | null };
      after: { name: string; description: string | null };
    }
  | {
      kind: 'create_menu_items';
      toolCallId: string;
      categories: { name: string; isNew: boolean; items: { name: string; price: number; description: string | null }[] }[];
    };
