"use client";

import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from "@/components/ui/sidebar";
import { NavLinkWrapper } from "./nav-link-wrapper";
import type { SidebarNavItem } from "@/types/sidebar";
import { usePathname } from "next/navigation";

interface NavItemsProps {
  items: SidebarNavItem[];
}

export function NavItems({ items }: NavItemsProps) {
  const pathname = usePathname();
  const { toggleSidebar, isMobile } = useSidebar();

  return (
    <SidebarMenu>
      {items.map((item) => (
        <SidebarMenuItem key={item.label}>
          <SidebarMenuButton
            tooltip={item.label}
            isActive={isActive(item, pathname)}
            onClick={() => isMobile && toggleSidebar()}
            render={<NavLinkWrapper to={item.url} />}
          >
            {item.icon && <item.icon />}
            <span className="truncate">{item.label}</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}

/** Sub-pages keep their section highlighted, unless the item is `exact`. */
function isActive(item: SidebarNavItem, pathname: string) {
  if (!item.url) return false;
  return item.exact ? pathname === item.url : pathname === item.url || pathname.startsWith(`${item.url}/`);
}
