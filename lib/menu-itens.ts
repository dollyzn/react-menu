import type { SidebarNavItem } from "@/types/sidebar";
import {
  LayoutDashboard,
  FolderTree,
  Package,
  Puzzle,
  Store,
} from "lucide-react";

/** Itens da sidebar dentro de `/manage/[storeId]`. */
export function getManageMenuItems(storeId: string): SidebarNavItem[] {
  const base = `/manage/${storeId}`;
  return [
    {
      label: "Loja",
      url: base,
      icon: Store,
      order: 0,
    },
    {
      label: "Visão Geral",
      url: `${base}/overview`,
      icon: LayoutDashboard,
      order: 1,
    },
    {
      label: "Categorias",
      url: `${base}/categories`,
      icon: FolderTree,
      order: 2,
    },
    {
      label: "Itens",
      url: `${base}/items`,
      icon: Package,
      order: 3,
    },
    {
      label: "Adicionais",
      url: `${base}/addons`,
      icon: Puzzle,
      order: 4,
    },
  ].sort((a, b) => a.order - b.order);
}
