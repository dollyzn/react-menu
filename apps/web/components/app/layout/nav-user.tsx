"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronsUpDown, ExternalLink, LogOutIcon, Palette, Settings } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { ThemeSegmented } from "@/components/app/theme/theme-segmented";
import { InstallAppMenuGroup, useInstallFlow } from "@/components/app/pwa/install-app";
import { useSession } from "@/contexts/session-provider";
import { useRouter } from "next/navigation";
import { redirectToLogout } from "@/utils/navigation";

/** The only account menu: settings, public menu, theme, install, sign out. */
export function NavUser() {
  const { isMobile } = useSidebar();
  const { user } = useSession();
  const { store: storeId } = useParams<{ store?: string }>();
  const install = useInstallFlow("staff");
  const router = useRouter();

  if (!user) return null;
  const currentStore = user.stores.find((store) => store.id === storeId);

  async function handleLogout() {
    redirectToLogout(router);
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                aria-label="Menu do usuário"
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              />
            }
          >
            <UserInfo user={user} />
            <ChevronsUpDown className="ml-auto size-4 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-64 rounded-xl"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5">
                  <UserInfo user={user} />
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>

            <DropdownMenuSeparator />

            <DropdownMenuGroup>
              <DropdownMenuItem render={<Link href="/app/settings" />}>
                <Settings className="text-muted-foreground" /> Configurações
              </DropdownMenuItem>
              {currentStore && (
                <DropdownMenuItem render={<a href={`/${currentStore.slug}`} target="_blank" rel="noreferrer" />}>
                  <ExternalLink className="text-muted-foreground" /> Ver cardápio da loja
                </DropdownMenuItem>
              )}
            </DropdownMenuGroup>

            <DropdownMenuSeparator />

            {/* Not a menu item: picking a theme keeps the menu open. */}
            {/* Same spacing as DropdownMenuItem (px-1.5, gap-1.5). */}
            <div className="flex items-center justify-between gap-1.5 px-1.5 py-0.5 text-sm">
              <span className="flex items-center gap-1.5">
                <Palette className="size-4 text-muted-foreground" /> Tema
              </span>
              <ThemeSegmented />
            </div>

            <DropdownMenuSeparator />

            {install.pwa.available && <InstallAppMenuGroup onInstall={install.install} />}

            <DropdownMenuGroup>
              <DropdownMenuItem onClick={handleLogout}>
                <LogOutIcon className="text-muted-foreground" /> Sair
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        {install.steps}
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

function UserInfo({ user }: { user: User }) {
  return (
    <>
      <Avatar className="h-8 w-8 rounded-full border">
        <AvatarImage
          src={`https://api.dicebear.com/9.x/lorelei/svg?seed=${user.name ?? user.email}`}
          alt={user.name ?? user.email}
        />
        <AvatarFallback className="rounded-full">
          {user.name?.substring(0, 2)?.toUpperCase() ?? "US"}
        </AvatarFallback>
      </Avatar>
      <div className="grid flex-1 text-left text-sm leading-tight">
        <span className="truncate font-medium text-foreground">
          {user.name}
        </span>
        <span className="truncate text-xs text-muted-foreground">
          {user.email}
        </span>
      </div>
    </>
  );
}
