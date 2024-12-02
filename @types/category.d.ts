interface Category {
  id: string;
  storeId: number;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  items?: Omit<Item, "category">[];
}
