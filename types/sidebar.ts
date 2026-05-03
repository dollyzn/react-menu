import type { LucideIcon } from "lucide-react";

export interface SidebarNavItem {
  label: string;
  url: string | undefined;
  icon: LucideIcon;
  order: number;
  children?: SidebarNavItem[];
}
