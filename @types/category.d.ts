interface Category {
  id: number;
  storeId: number;
  name: string;
  description: string | null;
  order: number;
  createdAt: string;
  updatedAt: string;
  items?: Omit<Item, "category", "addons">[];
}
