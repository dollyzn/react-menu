export type OrderStatus =
  | 'pending_payment'
  | 'received'
  | 'preparing'
  | 'ready'
  | 'completed'
  | 'cancelled';
export type OrderChannel = 'online' | 'pos';
export type PaymentMethod = 'mercado_pago' | 'counter';
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
  store: { name: string; slug: string; pickupEtaMinutes: number; address: string | null; phone: string | null };
  /** Status changes, oldest first. */
  timeline: { status: OrderStatus; at: string }[];
  items: (Pick<OrderItem, 'itemId' | 'name' | 'unitPrice' | 'quantity' | 'notes' | 'total'> & {
    addons: Pick<OrderItemAddon, 'addonId' | 'name' | 'unitPrice'>[];
  })[];
  /** Mercado Pago checkout to finish paying, while payment is pending. */
  checkoutUrl: string | null;
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
    counterPaymentEnabled: boolean;
    mercadoPagoEnabled: boolean;
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
  addons: PublicMenuAddon[];
};

export type PublicMenuAddon = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  photoUrl: string | null;
  isAvailable: boolean;
};
