import type { LucideIcon } from "lucide-react";

export interface SidebarNavItem {
  label: string;
  url: string | undefined;
  icon: LucideIcon;
  order: number;
  /** Active only on this exact URL (default: also on sub-pages). */
  exact?: boolean;
  children?: SidebarNavItem[];
}
