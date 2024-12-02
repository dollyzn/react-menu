interface Item {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  price: number;
  photoUrl: string | null;
  createdAt: string;
  updatedAt: string;
  category?: Omit<Category, "items">;
}
