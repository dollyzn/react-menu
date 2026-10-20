interface Addon {
  id: string;
  storeId: number;
  name: string;
  description: string | null;
  price: number;
  photoUrl: string | null;
  createdAt: string;
  updatedAt: string;
}
