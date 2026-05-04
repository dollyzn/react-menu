"use client";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
} from "@/components/ui/sidebar";
import { NavItems } from "./nav-items";
import type { SidebarNavItem } from "@/types/sidebar";

interface NavMainProps {
  items: SidebarNavItem[];
}

export function NavMain({ items }: NavMainProps) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>Navegação</SidebarGroupLabel>
      <SidebarGroupContent className="flex flex-col gap-2">
        <NavItems items={items} />
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
