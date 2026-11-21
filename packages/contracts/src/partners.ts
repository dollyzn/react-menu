import type {
  OrderItem,
  OrderLineInput,
  OrderStatus,
  PaymentStatus,
  PointPaymentType,
} from './orders.ts';

/**
 * Partners (ADR 0024): people outside the store who sell its menu to their
 * own customers on a card machine the store lent them, for a commission.
 * Managers: /stores/:id/partners. Partners: /stores/:id/partner/*.
 */

/** A person's role inside a partner: its manager sees the commission; an attendant only sells. */
export type PartnerMemberRole = 'manager' | 'attendant';

/** percent: of the order's subtotal (10 = 10%); per_unit: R$ for each unit sold. */
export type PartnerCommissionType = 'percent' | 'per_unit';
/** Up to when the partner cancels alone (an unpaid order can always be dropped). */
export type PartnerCancelPolicy = 'never' | 'until_kitchen' | 'until_ready';
/** all: the whole menu; selected: the categories chosen, minus the excluded items. */
export type PartnerCatalogMode = 'all' | 'selected';

export type PartnerCommissionRule = {
  type: PartnerCommissionType;
  value: number;
  /** Since when this rule applies (orders keep the commission of their time). */
  since: string;
};

/** A partner as the managers see it. */
export type StorePartner = {
  id: string;
  name: string;
  commissionType: PartnerCommissionType;
  commissionValue: number;
  commissionUpdatedAt: string;
  cancelPolicy: PartnerCancelPolicy;
  catalogMode: PartnerCatalogMode;
  /** Only with `catalogMode` `selected`. */
  categoryIds: number[];
  excludedItemIds: string[];
  pausedAt: string | null;
  /** People working for it. */
  membersCount: number;
  /** Card machines lent to it. */
  terminals: { terminalId: string; name: string }[];
  createdAt: string;
  updatedAt: string;
};

export type PartnerInput = {
  name: string;
  commissionType: PartnerCommissionType;
  commissionValue: number;
  cancelPolicy: PartnerCancelPolicy;
};

export type PartnerCatalogInput = {
  mode: PartnerCatalogMode;
  categoryIds: number[];
  excludedItemIds: string[];
};

/** What the partner area starts from (GET /stores/:id/partner/context). */
export type PartnerContext = {
  store: { id: string; name: string; photoUrl: string | null; isOpen: boolean };
  partner: {
    id: string;
    name: string;
    /** Null for the partner's attendants: only its managers see the commission. */
    commission: PartnerCommissionRule | null;
    cancelPolicy: PartnerCancelPolicy;
    paused: boolean;
  };
  /** The signed-in person's role inside the partner. */
  me: { role: PartnerMemberRole };
  /** The machine lent to the partner (null: none yet, they can't sell). */
  terminal: { terminalId: string; name: string } | null;
  /** How the store's machines charge (the charge dialog). */
  point: { available: boolean; paymentTypes: PointPaymentType[]; maxInstallments: number };
};

/** A cancellation asked of a manager. */
export type OrderCancelRequest = {
  id: number;
  orderId: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedBy: { id: string; name: string | null } | null;
  decidedBy: { id: string; name: string | null } | null;
  decidedAt: string | null;
  decisionNote: string | null;
  createdAt: string;
};

/** The managers' list of requests waiting (GET /orders/cancel-requests). */
export type PendingCancelRequest = OrderCancelRequest & {
  order: {
    id: string;
    number: number;
    customerName: string;
    status: OrderStatus;
    total: number;
    partner: { id: string; name: string } | null;
  };
};

/**
 * Where a partner's order is, for the partner's board: waiting for the
 * machine, in the store's kitchen, ready at the store, with the partner
 * (handed over), delivered to the customer, or cancelled.
 */
export type PartnerOrderStage =
  | 'awaiting_payment'
  | 'in_kitchen'
  | 'ready'
  | 'with_partner'
  | 'delivered'
  | 'cancelled';

/** An order as the partner sees it (no store-internal data). */
export type PartnerOrder = {
  id: string;
  number: number;
  businessDate: string;
  customerName: string;
  customerPhone: string | null;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  stage: PartnerOrderStage;
  subtotal: number;
  total: number;
  amountDue: number;
  /** Null for the partner's attendants (only its managers see the commission). */
  commissionAmount: number | null;
  notes: string | null;
  readyAt: string | null;
  /** The store handed it to the partner. */
  completedAt: string | null;
  /** The partner handed it to the customer. */
  partnerDeliveredAt: string | null;
  /** The commission was paid (settlement date). */
  settledAt: string | null;
  createdAt: string;
  items: OrderItem[];
  cancelRequest: OrderCancelRequest | null;
  /** What the partner may do now. */
  can: { cancel: boolean; requestCancel: boolean; charge: boolean; deliver: boolean };
};

export type CreatePartnerOrderInput = {
  customer: { name: string; phone?: string | null };
  lines: OrderLineInput[];
  notes?: string | null;
};

/** Totals of a partner's commission (the partner's screen and the managers'). */
export type PartnerCommissionTotals = {
  /** Paid, not handed over yet. */
  inProgress: { orders: number; amount: number };
  /** Handed over, commission still to pay. */
  toReceive: { orders: number; amount: number };
  /** Commission already paid. */
  received: { orders: number; amount: number };
};

export type PartnerSettlement = {
  id: string;
  partnerId: string;
  /** Up to this business day (null: orders picked one by one). */
  until: string | null;
  ordersCount: number;
  total: number;
  note: string | null;
  paidAt: string;
  paidBy: { id: string; name: string | null } | null;
};

/** GET /stores/:id/partner/commissions. */
export type PartnerCommissionOverview = {
  rule: PartnerCommissionRule;
  totals: PartnerCommissionTotals;
  settlements: PartnerSettlement[];
};

/**
 * A row of the managers' partners table (GET /partners?page=…): the
 * partner, its sales in the period (`createdAt=from~to`) and what is to pay.
 */
export type PartnerListRow = StorePartner & {
  period: { orders: number; sales: number; commission: number };
  toPay: { orders: number; amount: number };
};

/** GET /partners/:id/stats?from&to: the partner's overview. */
export type PartnerStats = {
  period: { from: string; to: string };
  /** Paid, not cancelled orders of the period, and of the period before (same length). */
  current: PartnerPeriodNumbers;
  previous: PartnerPeriodNumbers;
  daily: { date: string; orders: number; sales: number; commission: number }[];
  /** All time, whatever the period. */
  totals: PartnerCommissionTotals;
};

export type PartnerPeriodNumbers = { orders: number; sales: number; commission: number; averageTicket: number };

/** POST /partners/:id/settlements: up to a day, or the orders picked. */
export type SettlePartnerInput =
  | { until: string; orderIds?: never; note?: string | null }
  | { orderIds: string[]; until?: never; note?: string | null };

/** An order on the managers' partner page (commission column, settled or not). */
/** GET /partners/:id/sales also sends, in `meta`, the filter's whole commission. */
export type PartnerSalesMeta = { commissionTotal: number };

/** Where a sale's commission is: to pay (handed over), paid, or the order is still at the store. */
export type PartnerSettlementState = 'to_pay' | 'paid' | 'in_store';

export type PartnerSaleRow = {
  id: string;
  number: number;
  businessDate: string;
  createdAt: string;
  settlement: PartnerSettlementState;
  customerName: string;
  status: OrderStatus;
  total: number;
  commissionAmount: number;
  completedAt: string | null;
  partnerDeliveredAt: string | null;
  settlementId: string | null;
  settledAt: string | null;
};
