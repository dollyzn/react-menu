import type { IngredientUnit, OrderChannel, PaymentMethod } from './orders.ts';

/** `GET /stores/:id/reports/sales?from=YYYY-MM-DD&to=YYYY-MM-DD` (business days, inclusive). */
export interface SalesReport {
  period: { from: string; to: string; days: number };
  /** Same length, right before `period`. */
  previousPeriod: { from: string; to: string };
  summary: {
    revenue: number;
    orders: number;
    averageTicket: number;
    /** Items sold (quantities summed). */
    units: number;
    cancelled: { orders: number; value: number };
    previous: { orders: number; revenue: number };
  };
  /** Every day of the period, zeros included. */
  daily: { date: string; orders: number; revenue: number }[];
  /** 24 entries (0–23, store timezone). */
  hourly: { hour: number; orders: number }[];
  /** Best sellers first. */
  items: { name: string; quantity: number; revenue: number }[];
  /** Add-ons and choices, top 15. */
  addons: { name: string; quantity: number; revenue: number }[];
  payments: { method: PaymentMethod; orders: number; revenue: number }[];
  channels: { channel: OrderChannel; orders: number; revenue: number }[];
  /** Net stock the sales took (cancellations put back). */
  stock: { ingredientId: string; name: string; unit: IngredientUnit; icon: string | null; consumed: number }[];
}

/** `GET /stores/:id/dashboard/today`: the store today, live. */
export interface DashboardToday {
  /** Business day, "YYYY-MM-DD". */
  date: string;
  generatedAt: string;
  sales: {
    revenue: number;
    orders: number;
    averageTicket: number;
    /** Same weekday last week, up to the same time. */
    lastWeek: { orders: number; revenue: number };
  };
  /** Revenue accumulated by the end of each hour (0–23); `today` is null for hours still ahead. */
  pace: { hour: number; today: number | null; lastWeek: number }[];
  /** Open orders now. */
  queue: { pendingPayment: number; received: number; preparing: number; ready: number };
  /** From reaching the kitchen to ready, today's orders. */
  kitchen: { averageMinutes: number | null; orders: number };
  visits: {
    today: number;
    /** Same weekday last week, up to the same time. */
    lastWeek: number;
    onlineOrders: number;
    /** Online orders ÷ visits (null without visits). */
    conversion: number | null;
    /** Last 14 days. */
    daily: { date: string; visits: number }[];
  };
  topItems: { name: string; quantity: number }[];
  /** Ingredients at or below their minimum (stores that track stock). */
  lowStock: { id: number; name: string; unit: IngredientUnit; icon: string | null; stockQuantity: number; minStock: number }[];
  menu: { items: number; paused: number; soldOut: number; withoutPhoto: number };
  store: { isOpen: boolean; closesAt: string | null; opensAt: string | null };
}
