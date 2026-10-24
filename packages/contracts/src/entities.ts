/**
 * Serialized shapes of the Lucid models (camelCase, dates as ISO strings).
 * Keep in sync with apps/api/app/models/*.
 */

export type StoreStatus = 'open' | 'closed' | 'maintenance';
export type StoreRole = 'manager' | 'attendant' | 'kitchen';
export type UserStatus = 'active' | 'inactive' | 'suspended';

export type Store = {
  id: string;
  name: string;
  status: StoreStatus;
  address: string | null;
  instagramUrl: string | null;
  ifoodUrl: string | null;
  bannerUrl: string | null;
  photoUrl: string | null;
  slug: string;
  isDefault: boolean;
  phone: string | null;
  description: string | null;
  /** Average minutes from order to pickup. */
  pickupEtaMinutes: number;
  /** When true, stock is tracked and can make items unavailable. */
  inventoryEnabled: boolean;
  counterPaymentEnabled: boolean;
  /** Kitchen groups identical pastries from up to this many later orders (0 = arrival order). */
  kitchenBatchLookahead: number;
  /** True when Mercado Pago credentials are configured (never exposed). */
  mercadoPagoEnabled: boolean;
  /** Public key for the in-app card form (safe to expose). */
  mercadoPagoPublicKey: string | null;
  /** Card installments offered at checkout (1 = à vista). */
  maxInstallments: number;
  /** Opens and closes by itself following `openingHours`. */
  scheduleEnabled: boolean;
  openingHours: OpeningInterval[];
  /** "Close now" on a schedule: closed until this moment (ISO). */
  closedUntil: string | null;
  /** Open right now (status, schedule and "close now" together). */
  isOpen: boolean;
  /** On a schedule: when it closes (if open) / opens next (if closed), ISO. */
  closesAt: string | null;
  opensAt: string | null;
  createdAt: string;
  updatedAt: string;
  categories?: Category[];
  addons?: Addon[];
};

export type Category = {
  id: number;
  storeId: string;
  name: string;
  description: string | null;
  order: number;
  /** False for drinks and ready-made products: they skip the kitchen. */
  requiresPreparation: boolean;
  itemsCount?: number;
  createdAt: string;
  updatedAt: string;
  items?: Item[];
};

export type Item = {
  id: string;
  categoryId: number;
  name: string;
  description: string | null;
  /** Decimal(10,2) serialized as a number. */
  price: number;
  photoUrl: string | null;
  views: number;
  order: number;
  /** Manual "sold out" switch. */
  isAvailable: boolean;
  addonsCount?: number;
  createdAt: string;
  updatedAt: string;
  category?: Category;
  addons?: Addon[];
  /** Choice groups, in display order. */
  optionGroups?: OptionGroup[];
};

export type Addon = {
  id: string;
  storeId: string;
  name: string;
  description: string | null;
  price: number;
  photoUrl: string | null;
  isAvailable: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Permission = {
  id: number;
  name: string;
  label: string;
  category: string | null;
};

export type Role = {
  id: number;
  name: string;
  permissions: Permission[];
};

export type User = {
  id: string;
  roleId: number | null;
  name: string | null;
  firstName: string | null;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  status: UserStatus;
  superUser: boolean;
  createdAt: string;
  updatedAt: string;
  role?: Role | null;
  stores?: Store[];
};

/** `data.user` of POST /auth/login and GET /auth/me. */
export type SessionUser = Omit<User, 'role' | 'stores'> & {
  role: Role | null;
  /** Each store the user belongs to, with their role in it. */
  stores: (Store & { role: StoreRole })[];
  tokenExpiresAt: string | null;
};

/**
 * One row of a bulk edit (POST /stores/:id/items|addons/bulk-update): the
 * final values plus the `updatedAt` the client saw. A 409 `E_STALE_ROWS`
 * lists in `details.ids` the rows that changed meanwhile (nothing is saved).
 */
export type BulkUpdateChange = {
  id: string;
  updatedAt: string;
  price?: number;
  isAvailable?: boolean;
};

/**
 * A choice group ("Escolha o queijo": 1; "Molhos": até 2). Its options are
 * the store's add-ons, in display order.
 */
export type OptionGroup = {
  id: string;
  storeId: string;
  name: string;
  /** 0 = optional. */
  minChoices: number;
  maxChoices: number;
  options?: Addon[];
  /** How many items use the group (in the list). */
  itemsCount?: number;
  createdAt: string;
  updatedAt: string;
};

/**
 * One opening interval of the week: `day` 0 (Sunday) … 6 (Saturday), times
 * "HH:mm" in the store's timezone; `closes` before `opens` crosses midnight.
 */
export type OpeningInterval = { day: number; opens: string; closes: string };

/** Social sign-in providers (GET /auth/social/providers lists the configured ones). */
export type SocialProvider = "google" | "twitter" | "facebook";

/** A member of a store's team (GET /stores/:id/members). */
export type StoreMember = {
  id: string;
  name: string | null;
  email: string;
  role: StoreRole;
  /** When they joined the store. */
  since: string;
  /** Invited and hasn't set a password or signed in yet (the invite can be resent). */
  invitePending: boolean;
};
