"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { useLocalStorage } from "usehooks-ts";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";
import { InstallAppCard } from "@/components/app/pwa/install-app";
import { useSession } from "@/contexts/session-provider";
import { useStoreRole } from "@/hooks/use-store-role";
import { getManageMenuGroups } from "@/lib/menu-itens";
import { env } from "@/lib/env";
import { NavMain } from "./nav-main";
import { NavUser } from "./nav-user";
import { StoreSwitcher } from "./store-switcher";

/**
 * Store switcher on top, navigation grouped by area, account at the bottom.
 * Outside a store (e.g. Configurações) it keeps the last visited store's menu.
 */
export default function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const { user } = useSession();
  const { store } = useParams<{ store?: string }>();
  const [lastStoreId, setLastStoreId] = useLocalStorage<string | null>(
    `${env.NEXT_PUBLIC_STORAGE_BASE_NAME}:lastStoreId`,
    null,
    { initializeWithValue: false }
  );

  React.useEffect(() => {
    if (store && store !== lastStoreId) setLastStoreId(store);
  }, [store, lastStoreId, setLastStoreId]);

  const storeId = store ?? lastStoreId ?? user?.stores[0]?.id ?? "";
  const role = useStoreRole(storeId);
  const groups = React.useMemo(() => (storeId ? getManageMenuGroups(storeId, role) : []), [storeId, role]);

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <StoreSwitcher />
      </SidebarHeader>
      <SidebarContent className="overflow-x-hidden">
        <NavMain groups={groups} />
      </SidebarContent>
      <SidebarFooter className="gap-2">
        <InstallAppCard
          context="staff"
          variant="sidebar"
          title="Instale o painel"
          description="Tela cheia no tablet do PDV e da cozinha."
        />
        {user ? <NavUser /> : null}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
