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
  /** True when Mercado Pago credentials are configured (never exposed). */
  mercadoPagoEnabled: boolean;
  /** Only when the view count was loaded (public menu). */
  views?: number;
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
