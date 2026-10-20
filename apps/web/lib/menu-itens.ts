import type { StoreRole } from "@react-menu/contracts";
import type { SidebarNavItem } from "@/types/sidebar";
import {
  Boxes,
  ChefHat,
  ClipboardList,
  FolderTree,
  LayoutDashboard,
  Package,
  Puzzle,
  ShoppingCart,
  Store,
} from "lucide-react";

const ALL: StoreRole[] = ["manager", "attendant", "kitchen"];
const FRONT: StoreRole[] = ["manager", "attendant"];
const MANAGER: StoreRole[] = ["manager"];

/** Sidebar entries inside `/app/stores/[storeId]`, filtered by store role. */
export function getManageMenuItems(storeId: string, role: StoreRole | null): SidebarNavItem[] {
  const base = `/app/stores/${storeId}`;
  const items: (SidebarNavItem & { roles: StoreRole[] })[] = [
    { label: "Pedidos", url: `${base}/orders`, icon: ClipboardList, order: 0, roles: FRONT },
    { label: "Novo pedido (PDV)", url: `${base}/pos`, icon: ShoppingCart, order: 1, roles: FRONT },
    { label: "Cozinha", url: `${base}/kitchen`, icon: ChefHat, order: 2, roles: ALL },
    { label: "Loja", url: base, icon: Store, order: 3, roles: MANAGER },
    { label: "Visão Geral", url: `${base}/overview`, icon: LayoutDashboard, order: 4, roles: MANAGER },
    { label: "Categorias", url: `${base}/categories`, icon: FolderTree, order: 5, roles: MANAGER },
    { label: "Itens", url: `${base}/items`, icon: Package, order: 6, roles: MANAGER },
    { label: "Adicionais", url: `${base}/addons`, icon: Puzzle, order: 7, roles: MANAGER },
    { label: "Estoque", url: `${base}/inventory`, icon: Boxes, order: 8, roles: MANAGER },
  ];

  return items
    .filter((item) => role !== null && item.roles.includes(role))
    .sort((a, b) => a.order - b.order)
    .map(({ label, url, icon, order }) => ({ label, url, icon, order }));
}

/** Where each role lands after login. */
export function homeForRole(storeId: string, role: StoreRole | null) {
  const base = `/app/stores/${storeId}`;
  if (role === "kitchen") return `${base}/kitchen`;
  if (role === "attendant") return `${base}/orders`;
  return base;
}
