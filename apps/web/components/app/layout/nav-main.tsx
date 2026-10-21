"use client";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
} from "@/components/ui/sidebar";
import type { SidebarNavGroup } from "@/lib/menu-itens";
import { NavItems } from "./nav-items";

/** One labeled block per area (Operação, Cardápio, Gestão). */
export function NavMain({ groups }: { groups: SidebarNavGroup[] }) {
  return groups.map((group) => (
    <SidebarGroup key={group.label}>
      <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <NavItems items={group.items} />
      </SidebarGroupContent>
    </SidebarGroup>
  ));
}
