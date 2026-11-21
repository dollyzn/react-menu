import type { OrderCancelRequest } from './partners.ts';
import type { OpeningInterval } from './entities.ts';
export type OrderStatus =
  | 'pending_payment'
  | 'received'
  | 'preparing'
  | 'ready'
  | 'completed'
  | 'cancelled';
/** `partner`: sold by a partner on their card machine (ADR 0024). */
export type OrderChannel = 'online' | 'pos' | 'partner';
/** `mercado_pago` is legacy (Checkout Pro redirect); new orders use pix/card/counter. */
export type PaymentMethod = 'pix' | 'card' | 'point' | 'counter' | 'mercado_pago';
/**
 * How a counter payment was received, as the cashier recorded it. Credit and
 * debit here were charged on a machine outside the system (the integrated one
 * is `point`).
 */
export type CounterPaymentMethod = 'cash' | 'pix' | 'credit' | 'debit';
/** Methods a customer can pick at checkout. */
export type CheckoutPaymentMethod = 'pix' | 'card' | 'counter';
/** Online methods paid on the order page. */
export type OnlinePaymentMethod = 'pix' | 'card';
export type PaymentAttemptStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'refunded';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';
export type IngredientUnit = 'g' | 'kg' | 'ml' | 'l' | 'un';
export type StockMovementType = 'purchase' | 'adjustment' | 'waste' | 'consumption' | 'reversal';

export type OrderItemAddon = {
  id: number;
  orderItemId: number;
  addonId: string | null;
  name: string;
  /** The choice group it was picked in ("Recheio extra"); null for a plain add-on. */
  groupName: string | null;
  unitPrice: number;
};

export type OrderItem = {
  id: number;
  orderId: string;
  itemId: string | null;
  name: string;
  /**
   * The name on the staff screens (kitchen, board) when a choice renames the
   * item ("Pastel de Frango com Catupiry"); null = `name`.
   */
  displayName: string | null;
  unitPrice: number;
  quantity: number;
  /** Units the kitchen has finished (0..quantity). */
  preparedQuantity: number;
  requiresPreparation: boolean;
  notes: string | null;
  total: number;
  /** Added while the order waited in the queue (null: placed with it). */
  addedAt: string | null;
  addedById: string | null;
  addons: OrderItemAddon[];
};

/** Staff view of an order. */
export type Order = {
  id: string;
  storeId: string;
  /** Daily number per store, shown as #12. */
  number: number;
  businessDate: string;
  customerId: string | null;
  customerName: string;
  customerPhone: string | null;
  channel: OrderChannel;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  /** Counter orders: how it was paid (null until paid, and on orders paid before this was kept). */
  counterMethod: CounterPaymentMethod | null;
  /** When the payment was recorded (null on orders paid before this was kept). */
  paidAt: string | null;
  /** Who received a counter payment. */
  paidById: string | null;
  /**
   * "Pagar depois" (fiado): when it was sent that way. Handed over unpaid and
   * settled another day; open while `paymentStatus` isn't `paid`.
   */
  payLaterAt: string | null;
  subtotal: number;
  total: number;
  /** Received so far (all receipts); paid when it covers the total. */
  amountPaid: number;
  /** Still to receive: what was added after it was paid, or all of it. */
  amountDue: number;
  notes: string | null;
  publicToken: string;
  createdById: string | null;
  readyAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Channel `partner` (ADR 0024): who sold it. */
  partnerId: string | null;
  /** The partner's commission, fixed when it was placed. */
  commissionAmount: number | null;
  /** The partner handed it to their customer (after the store handed it to them). */
  partnerDeliveredAt: string | null;
  /** Commission paid in this settlement (null: still to pay). */
  partnerSettlementId: string | null;
  /** On the staff's lists and details: the partner's name. */
  partner?: { id: string; name: string } | null;
  /** On the staff's lists and details: a cancellation waiting for a manager. */
  cancelRequest?: OrderCancelRequest | null;
  items: OrderItem[];
  /** Only on GET /orders/:id: status changes and who made them. */
  history?: OrderHistoryEntry[];
  /** Only on GET /orders/:id: online payment attempts, oldest first. */
  payments?: StaffPayment[];
  /** Only on GET /orders/:id: cancelled after an online payment that wasn't refunded yet. */
  refundPending?: boolean;
  /** Only on GET /orders/:id: who received the counter payment. */
  paidBy?: { id: string; name: string | null } | null;
  /** Only on GET /orders/:id: every amount received, oldest first. */
  receipts?: OrderReceipt[];
};

/** Money received for an order (it may be paid in more than one go). */
export type OrderReceipt = {
  amount: number;
  /** Card fee the customer paid on top (online checkout); not part of `amount`. */
  fee: number;
  paymentMethod: PaymentMethod;
  counterMethod: CounterPaymentMethod | null;
  receivedAt: string;
  /** Who took it at the counter (null: online or the card machine). */
  receivedBy: { id: string; name: string | null } | null;
};

/** A payment attempt as staff see it (no gateway ids). */
export type StaffPayment = {
  method: OnlinePaymentMethod;
  status: PaymentAttemptStatus;
  statusDetail: string | null;
  amount: number;
  /** Card fee the customer paid on top of `amount`. */
  fee: number;
  createdAt: string;
};

export type OrderHistoryEntry = {
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  createdAt: string;
  /** null: the customer (online order) or the system (payment webhook). */
  user: { id: string; name: string | null } | null;
};

/** Customer view at GET /public/orders/:token (no internal ids or phone). */
export type PublicOrder = Pick<
  Order,
  | 'number'
  | 'customerName'
  | 'status'
  | 'paymentMethod'
  | 'paymentStatus'
  | 'subtotal'
  | 'total'
  | 'amountDue'
  | 'notes'
  | 'createdAt'
  | 'readyAt'
  | 'completedAt'
> & {
  publicToken: string;
  store: {
    name: string;
    slug: string;
    pickupEtaMinutes: number;
    address: string | null;
    phone: string | null;
    /** The store's logo (the tracking page uses it as its icon). */
    photoUrl: string | null;
  };
  /** Status changes, oldest first. */
  timeline: { status: OrderStatus; at: string }[];
  items: (Pick<OrderItem, 'itemId' | 'name' | 'unitPrice' | 'quantity' | 'notes' | 'total'> & {
    addons: Pick<OrderItemAddon, 'addonId' | 'name' | 'groupName' | 'unitPrice'>[];
  })[];
  /** Latest payment attempt (Pix or card), if any. */
  payment: PublicPayment | null;
  /** How the order can be paid; only while it waits for payment. */
  checkout: {
    methods: OnlinePaymentMethod[];
    mercadoPagoPublicKey: string | null;
    /** Card installments the store offers (1 = à vista). */
    maxInstallments: number;
    /** Card fee the customer pays on top, in percent per type; null: none. */
    cardFees: CardFees | null;
  } | null;
};

/** Percent of the order the customer pays on top for each card type. */
export type CardFees = { credit: number; debit: number };

/** A payment attempt as the customer sees it (no gateway ids). */
export type PublicPayment = {
  method: OnlinePaymentMethod;
  status: PaymentAttemptStatus;
  /** Gateway detail, e.g. `cc_rejected_insufficient_amount`. */
  statusDetail: string | null;
  /** What went to the order. */
  amount: number;
  /** Card fee paid on top of `amount` (0: none). */
  fee: number;
  /** Pix to pay, while it is pending. */
  pix: { qrCode: string; ticketUrl: string | null; expiresAt: string | null } | null;
  /** 3-D Secure: the bank's page where the payer confirms the card (pending only). */
  challenge: { url: string; expiresAt: string | null } | null;
  /** Development fake gateway: the page may simulate the payment. */
  simulated: boolean;
};

/** POST /public/orders/:token/payments. Card data is tokenized in the browser. */
export type PublicPaymentRequest = {
  method: OnlinePaymentMethod;
  payer: { email: string };
  card?: {
    token: string;
    installments: number;
    paymentMethodId: string;
    /** credit_card or debit_card, from the card form. */
    paymentTypeId?: string;
    issuerId?: string;
    identification?: { type: string; number: string };
  };
  /** The total shown to the customer (order plus card fee); 409 `E_AMOUNT_CHANGED` when it changed. */
  amount?: number;
};

/** Response of placing a public order. */
export type PlacedPublicOrder = PublicOrder & {
  /**
   * History token for this device (`Customer-Token` header): set on the
   * customer's first order or when the device already holds it; null when
   * the phone belongs to a customer this device is not linked to.
   */
  customerToken: string | null;
};

/** One order in a customer's history list. */
export type PublicOrderSummary = Pick<
  PublicOrder,
  'publicToken' | 'number' | 'status' | 'paymentStatus' | 'total' | 'createdAt' | 'readyAt'
> & {
  store: { name: string; slug: string };
  items: { name: string; quantity: number }[];
};

/** GET /public/menu/:slug/my-orders */
export type CustomerOrders = {
  customer: { name: string; phone: string };
  orders: PublicOrderSummary[];
};

/** One line of a new order. Prices are always computed by the API. */
export type OrderLineInput = {
  itemId: string;
  quantity: number;
  /** Add-ons outside choice groups. */
  addonIds?: string[];
  /** What was picked in each choice group (the group sets the price). */
  choices?: { groupId: string; addonId: string }[];
  notes?: string;
};

export type CreatePublicOrderInput = {
  customer: { name: string; phone: string };
  paymentMethod: PaymentMethod;
  lines: OrderLineInput[];
  notes?: string;
};

export type CreatePosOrderInput = {
  customer: { name: string; phone?: string };
  lines: OrderLineInput[];
  notes?: string;
  /** Paid as it was sent; left out: paid later or on the card machine. */
  counterMethod?: CounterPaymentMethod;
  /** About to be charged on the card machine (the store may hold it from the kitchen). */
  payOnMachine?: boolean;
  /** "Pagar depois" (fiado): handed over unpaid, settled another day; needs the phone. */
  payLater?: boolean;
};

/** GET /orders/pay-later (managers, paginated): open "pagar depois" orders, any day, oldest first by default. */
export type PayLaterOrder = Order & {
  /** Who sent it as "pagar depois". */
  payLaterBy: { id: string; name: string | null } | null;
};

/** GET /orders/pay-later/summary (managers): the tab's count and who owes the most. */
export type PayLaterSummary = {
  count: number;
  total: number;
  /** How many customers owe, and since when the oldest open order. */
  customers: number;
  since: string | null;
  /** Up to 12, the most owed first (one per phone, or per name without one). */
  debtors: { name: string; phone: string | null; orders: number; due: number }[];
};

/**
 * GET /orders/pay-later/customers (managers, paginated): open "pagar depois"
 * grouped by customer (one per phone, or per name without one), with their
 * orders oldest first.
 */
export type PayLaterCustomer = {
  /** The phone, or "name:<name>" without one. */
  key: string;
  name: string;
  phone: string | null;
  due: number;
  /** When the oldest open order was placed. */
  since: string;
  orders: PayLaterOrder[];
};

/** GET /orders/pay-later/customers sorts (allowlisted). */
export type PayLaterCustomerSort = "due:desc" | "since:asc" | "name:asc";

/**
 * POST /orders/pay-later/receive (managers): several open orders of one
 * customer received at once, each for what it owes, the same way. `amount`
 * is the total on screen (409 `E_AMOUNT_CHANGED` if it changed).
 */
export type ReceivePayLaterInput = {
  orderIds: string[];
  method: CounterPaymentMethod;
  amount: number;
};

export type ReceivePayLaterResult = { orders: number; amount: number };

/** GET /orders/pay-later sorts (allowlisted). */
export type PayLaterSort = "createdAt:asc" | "createdAt:desc" | "amountDue:desc" | "amountDue:asc";

/** POST /orders/:id/pay-later: who to charge, when the order lacks it or it is corrected. */
export type PayLaterInput = { name?: string; phone?: string };

/** POST /orders/:id/items: items added to an order still in the queue. */
export type AddOrderItemsInput = {
  lines: OrderLineInput[];
  /** Received now: how. Left out: on the card machine, or at pickup. */
  counterMethod?: CounterPaymentMethod;
  /** With `counterMethod`: what the cashier showed and took (all that is due after adding). */
  amount?: number;
};

/** POST /orders/:id/payment ("Receber pagamento"). */
export type ReceivePaymentInput = {
  method: CounterPaymentMethod;
  /** The amount the cashier saw and took: refused (409 E_AMOUNT_CHANGED) if what is due changed. */
  amount?: number;
};

export type Ingredient = {
  id: number;
  storeId: string;
  name: string;
  unit: IngredientUnit;
  /** Emoji shown in the kitchen. */
  icon: string | null;
  stockQuantity: number;
  minStock: number;
  isLowStock: boolean;
  /** Recipe quantity, when listed as part of a recipe. */
  quantity?: number;
  createdAt: string;
  updatedAt: string;
};

export type StockMovement = {
  id: number;
  storeId: string;
  ingredientId: number;
  type: StockMovementType;
  /** Signed: positive adds stock. */
  quantity: number;
  orderId: string | null;
  userId: string | null;
  note: string | null;
  createdAt: string;
};

/** A kitchen batch: identical units to make together. */
export type ProductionBatch = {
  key: string;
  name: string;
  addons: string[];
  /** The same add-ons by group, for the screen: the group once, then its picks; null = outside a group. */
  addonGroups: { group: string | null; items: string[] }[];
  notes: string | null;
  quantity: number;
  units: {
    orderId: string;
    orderNumber: number;
    lineId: number;
    quantity: number;
    /** Sold by a partner (ADR 0024): their name on the ticket. */
    partnerName: string | null;
    /** Someone asked a manager to cancel the order: hold it. */
    cancelRequested: boolean;
  }[];
  /** Total ingredients for the whole batch. */
  ingredients: { name: string; unit: IngredientUnit; icon: string | null; quantity: number }[];
};

/** GET /public/menu[/:slug]: what customers see (no private store fields). */
/** GET /public/stores: menus to list in the sitemap. */
export type PublicStoreListing = { slug: string; isDefault: boolean; updatedAt: string };

export type PublicMenu = {
  store: {
    id: string;
    name: string;
    slug: string;
    status: 'open' | 'closed' | 'maintenance';
    isOpen: boolean;
    /** On a schedule: when it closes (if open) / opens next (if closed), ISO. */
    closesAt: string | null;
    opensAt: string | null;
    /** The weekly schedule when the store follows one. */
    openingHours: OpeningInterval[] | null;
    description: string | null;
    address: string | null;
    phone: string | null;
    instagramUrl: string | null;
    ifoodUrl: string | null;
    bannerUrl: string | null;
    bannerBlur: string | null;
    photoUrl: string | null;
    photoBlur: string | null;
    pickupEtaMinutes: number;
    /** Served at "/"; its /<slug> page is a duplicate (canonical "/"). */
    isDefault: boolean;
    updatedAt: string;
    /** Checkout options, online first. */
    paymentMethods: CheckoutPaymentMethod[];
    /** Card fee the customer pays on top online; null: none. */
    cardFees: CardFees | null;
  };
  categories: PublicMenuCategory[];
};

export type PublicMenuCategory = {
  id: number;
  name: string;
  description: string | null;
  items: PublicMenuItem[];
};

export type PublicOptionGroup = {
  id: string;
  name: string;
  /** 0 = optional; the order needs at least this many. */
  minChoices: number;
  maxChoices: number;
  /** The same option may be picked more than once (counted with −/+). */
  allowRepeat: boolean;
  /**
   * Price by pick order (the nth pick, in the order chosen, costs the nth
   * price; the last repeats), instead of the options' `price`. Null: per option.
   */
  pickPrices: number[] | null;
  options: PublicMenuAddon[];
};

export type PublicMenuItem = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  photoUrl: string | null;
  photoBlur: string | null;
  /** False when switched off or (with stock tracking) out of an ingredient. */
  isAvailable: boolean;
  /** Units the stock still makes (stores that track stock, items with a recipe); null = no limit. */
  stockLeft: number | null;
  addons: PublicMenuAddon[];
  /** Choice groups the customer fills in, in order (options are add-ons). */
  optionGroups: PublicOptionGroup[];
};

export type PublicMenuAddon = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  photoUrl: string | null;
  /** Blurred preview of the photo (data URL), shown while it loads. */
  photoBlur: string | null;
  isAvailable: boolean;
  /** Like the item's: null = no limit. */
  stockLeft: number | null;
};

/** GET /stores/:id/customers?search= (POS autocomplete). */
export type CustomerSuggestion = {
  id: string;
  name: string;
  /** Digits with country code (55...). */
  phone: string;
  ordersCount: number;
  lastOrderAt: string | null;
};

/* ---------------------- Mercado Pago Point (ADR 0020) ---------------------- */

/** How the card machine charges. */
export type PointPaymentType = 'credit_card' | 'debit_card' | 'qr';

/** GET /stores/:id/point: what the POS needs. */
export interface PointConfig {
  /** Mercado Pago is set up (or the development fake). */
  available: boolean;
  /** Machines turned on for this store. */
  terminals: { id: string; name: string }[];
  paymentTypes: PointPaymentType[];
  maxInstallments: number;
  printTicket: boolean;
  /**
   * A POS order charged on the machine reaches the kitchen only once it is
   * approved (`pending_payment` until then); off, it goes at once.
   */
  kitchenAfterPayment: boolean;
}

/** GET /stores/:id/point/terminals: every machine of the Mercado Pago account. */
export interface PointTerminalListing {
  id: string;
  /** "NEWLAND N950" */
  model: string;
  serial: string;
  /** PDV: takes charges from the system; STANDALONE: amounts typed on it. */
  operatingMode: 'PDV' | 'STANDALONE' | 'UNDEFINED' | string;
  posId: number | null;
  enabled: boolean;
  name: string | null;
  /** Lent to this partner (ADR 0024); null: the store's own. */
  partnerId: string | null;
}

export interface PointSettingsInput {
  paymentTypes: PointPaymentType[];
  maxInstallments: number;
  printTicket: boolean;
  kitchenAfterPayment?: boolean;
}

export interface PointChargeInput {
  terminalId?: string;
  /** How the machine charges (the store's types and limits hold). */
  paymentType: PointPaymentType;
  installments?: number;
}

/** A charge sent to a machine; the POS follows it until it settles. */
export interface PointCharge {
  id: string;
  /** The order it charges (the POS lists waiting charges by order). */
  order: { id: string; number: number; total: number; customerName: string };
  /** The store's name for the machine ("Balcão"). */
  terminalName: string | null;
  /** The order already had this charge waiting: picked up again, nothing new sent. */
  resumed: boolean;
  status: 'pending' | 'approved' | 'rejected' | 'expired' | 'refunded';
  /** Mercado Pago's reason (canceled_on_terminal, insufficient_amount…). */
  statusDetail: string | null;
  terminalId: string | null;
  amount: number;
  expiresAt: string | null;
  createdAt: string;
  /** The development fake: the POS shows "Simular". */
  simulated: boolean;
}
