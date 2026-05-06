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
            isActive={item.url === pathname}
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
