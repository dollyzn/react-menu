interface Item {
  id: string;
  categoryId: number;
  name: string;
  description: string | null;
  price: number;
  photoUrl: string | null;
  views: number;
  order: number;
  createdAt: string;
  updatedAt: string;
  category?: Omit<Category, "items">;
  addons?: Omit<Addon, "items">[];
}
