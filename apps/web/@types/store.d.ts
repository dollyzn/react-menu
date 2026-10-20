interface Store {
  id: string;
  name: string;
  status: "open" | "closed" | "maintenance";
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
