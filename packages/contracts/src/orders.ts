export type OrderStatus =
  | 'pending_payment'
  | 'received'
  | 'preparing'
  | 'ready'
  | 'completed'
  | 'cancelled';
export type OrderChannel = 'online' | 'pos';
/** `mercado_pago` is legacy (Checkout Pro redirect); new orders use pix/card/counter. */
export type PaymentMethod = 'pix' | 'card' | 'counter' | 'mercado_pago';
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
  unitPrice: number;
};

export type OrderItem = {
  id: number;
  orderId: string;
  itemId: string | null;
  name: string;
  unitPrice: number;
  quantity: number;
  /** Units the kitchen has finished (0..quantity). */
  preparedQuantity: number;
  requiresPreparation: boolean;
  notes: string | null;
  total: number;
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
  subtotal: number;
  total: number;
  notes: string | null;
  publicToken: string;
  createdById: string | null;
  readyAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
  /** Only on GET /orders/:id: status changes and who made them. */
  history?: OrderHistoryEntry[];
  /** Only on GET /orders/:id: online payment attempts, oldest first. */
  payments?: StaffPayment[];
  /** Only on GET /orders/:id: cancelled after an online payment that wasn't refunded yet. */
  refundPending?: boolean;
};

/** A payment attempt as staff see it (no gateway ids). */
export type StaffPayment = {
  method: OnlinePaymentMethod;
  status: PaymentAttemptStatus;
  statusDetail: string | null;
  amount: number;
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
    addons: Pick<OrderItemAddon, 'addonId' | 'name' | 'unitPrice'>[];
  })[];
  /** Latest payment attempt (Pix or card), if any. */
  payment: PublicPayment | null;
  /** How the order can be paid; only while it waits for payment. */
  checkout: {
    methods: OnlinePaymentMethod[];
    mercadoPagoPublicKey: string | null;
    /** Card installments the store offers (1 = à vista). */
    maxInstallments: number;
  } | null;
};

/** A payment attempt as the customer sees it (no gateway ids). */
export type PublicPayment = {
  method: OnlinePaymentMethod;
  status: PaymentAttemptStatus;
  /** Gateway detail, e.g. `cc_rejected_insufficient_amount`. */
  statusDetail: string | null;
  amount: number;
  /** Pix to pay, while it is pending. */
  pix: { qrCode: string; ticketUrl: string | null; expiresAt: string | null } | null;
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
    issuerId?: string;
    identification?: { type: string; number: string };
  };
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
  addonIds?: string[];
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
  notes: string | null;
  quantity: number;
  units: { orderId: string; orderNumber: number; lineId: number; quantity: number }[];
  /** Total ingredients for the whole batch. */
  ingredients: { name: string; unit: IngredientUnit; icon: string | null; quantity: number }[];
};

/** GET /public/menu[/:slug]: what customers see (no private store fields). */
export type PublicMenu = {
  store: {
    id: string;
    name: string;
    slug: string;
    status: 'open' | 'closed' | 'maintenance';
    isOpen: boolean;
    description: string | null;
    address: string | null;
    phone: string | null;
    instagramUrl: string | null;
    ifoodUrl: string | null;
    bannerUrl: string | null;
    photoUrl: string | null;
    pickupEtaMinutes: number;
    /** Checkout options, online first. */
    paymentMethods: CheckoutPaymentMethod[];
  };
  categories: PublicMenuCategory[];
};

export type PublicMenuCategory = {
  id: number;
  name: string;
  description: string | null;
  items: PublicMenuItem[];
};

export type PublicMenuItem = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  photoUrl: string | null;
  /** False when switched off or (with stock tracking) out of an ingredient. */
  isAvailable: boolean;
  /** Units the stock still makes (stores that track stock, items with a recipe); null = no limit. */
  stockLeft: number | null;
  addons: PublicMenuAddon[];
};

export type PublicMenuAddon = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  photoUrl: string | null;
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
