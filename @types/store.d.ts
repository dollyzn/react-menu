interface Store {
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
  views: number;
  createdAt: string;
  updatedAt: string;
  categories: Category[];
  addons: Addon[];
}

const StoreStatus = {
  OPEN: "open",
  CLOSED: "closed",
  MAINTENANCE: "maintenance",
} as const;

type StoreStatus = (typeof StoreStatus)[keyof typeof StoreStatus];
