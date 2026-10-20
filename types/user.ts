export interface Permission {
  id: number;
  name: string;
  label: string;
  category: string | null;
}

export interface Role {
  id: number;
  name: string;
  permissions: Permission[];
}

export interface User {
  id: string;
  name: string;
  email: string;
  superUser: boolean;
  role: Role | null;
  createdAt: string;
  updatedAt: string;
  stores: Store[];
}
