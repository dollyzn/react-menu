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

export interface SidebarNavGroup {
  label: string;
  items: SidebarNavItem[];
}

/**
 * Sidebar inside `/app/stores/[storeId]`, grouped by what the staff does,
 * filtered by store role. `exact` items are active only on their own URL.
 */
export function getManageMenuGroups(storeId: string, role: StoreRole | null): SidebarNavGroup[] {
  const base = `/app/stores/${storeId}`;
  const groups: { label: string; items: (SidebarNavItem & { roles: StoreRole[] })[] }[] = [
    {
      label: "Operação",
      items: [
        { label: "Pedidos", url: `${base}/orders`, icon: ClipboardList, order: 0, roles: FRONT },
        { label: "Novo pedido (PDV)", url: `${base}/pos`, icon: ShoppingCart, order: 1, roles: FRONT },
        { label: "Cozinha", url: `${base}/kitchen`, icon: ChefHat, order: 2, roles: ALL },
      ],
    },
    {
      label: "Cardápio",
      items: [
        { label: "Categorias", url: `${base}/categories`, icon: FolderTree, order: 0, roles: MANAGER },
        { label: "Itens", url: `${base}/items`, icon: Package, order: 1, roles: MANAGER },
        { label: "Adicionais", url: `${base}/addons`, icon: Puzzle, order: 2, roles: MANAGER },
      ],
    },
    {
      label: "Gestão",
      items: [
        { label: "Visão geral", url: `${base}/overview`, icon: LayoutDashboard, order: 0, roles: MANAGER },
        { label: "Estoque", url: `${base}/inventory`, icon: Boxes, order: 1, roles: MANAGER },
        { label: "Loja", url: base, icon: Store, order: 2, roles: MANAGER, exact: true },
      ],
    },
  ];

  return groups
    .map((group) => ({
      label: group.label,
      items: group.items
        .filter((item) => role !== null && item.roles.includes(role))
        .map(({ label, url, icon, order, exact }) => ({ label, url, icon, order, exact })),
    }))
    .filter((group) => group.items.length > 0);
}

/** Where each role lands after login. */
export function homeForRole(storeId: string, role: StoreRole | null) {
  const base = `/app/stores/${storeId}`;
  if (role === "kitchen") return `${base}/kitchen`;
  if (role === "attendant") return `${base}/orders`;
  return base;
}
