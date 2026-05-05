"use client";

import * as React from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { NavMain } from "./nav-main";
import { useSession } from "@/contexts/session-provider";
import { cn } from "@/lib/utils";
import { Icons } from "@/components/app/icons";
import { getManageMenuItems } from "@/lib/menu-itens";
import { env } from "@/lib/env";
import { useParams } from "next/navigation";
import { NavUser } from "./nav-user";

export default function AppSidebar({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  const { user } = useSession();
  const { store } = useParams();
  const storeId = typeof store === "string" ? store : "";

  const items = React.useMemo(
    () => (storeId ? getManageMenuItems(storeId) : []),
    [storeId]
  );

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className={cn(
                "group-data-[collapsible=icon]:p-0! cursor-default",
                "hover:bg-sidebar hover:text-sidebar-foreground",
                "active:bg-sidebar active:text-sidebar-foreground",
                "data-[active=true]:bg-sidebar data-[active=true]:text-sidebar-foreground",
                "data-[state=open]:hover:bg-sidebar data-[state=open]:hover:text-sidebar-foreground focus-visible:ring-0"
              )}
            >
              <div className="flex size-8 aspect-square items-center justify-center rounded-lg">
                <Icons.logo className="fill-primary p-1 size-full!" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">Cardápio</span>
                <span className="truncate text-xs text-muted-foreground">
                  v{env.NEXT_PUBLIC_BUILD_VERSION || "1.0"}
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarSeparator className="-mt-px mx-0" />
      <SidebarContent className="overflow-x-hidden">
        {!!items.length && <NavMain items={items} />}
      </SidebarContent>
      <SidebarSeparator className="mx-0 " />
      <SidebarFooter className="gap-2">
        {user ? <NavUser /> : null}
      </SidebarFooter>
    </Sidebar>
  );
}
