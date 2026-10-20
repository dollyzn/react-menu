"use client";

import { LogOutIcon, MoreVerticalIcon } from "lucide-react";
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
import { ModeSwitcher } from "./mode-switcher";
import { useSession } from "@/contexts/session-provider";
import { useRouter } from "next/navigation";
import { redirectToLogout } from "@/utils/navigation";

export function NavUser() {
  const { isMobile } = useSidebar();
  const { user } = useSession();
  const router = useRouter();

  if (!user) return null;

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
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              />
            }
          >
            <UserInfo user={user} />
            <MoreVerticalIcon className="ml-auto size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
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
              <ModeSwitcher />
            </DropdownMenuGroup>

            <DropdownMenuSeparator />

            <DropdownMenuGroup>
              <DropdownMenuItem onClick={handleLogout}>
                <LogOutIcon className="mr-1 h-4 w-4" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

function UserInfo({ user }: { user: User }) {
  return (
    <>
      <Avatar className="h-8 w-8 rounded-full border">
        <AvatarImage
          src={`https://api.dicebear.com/9.x/lorelei/svg?seed=${user.name}`}
          alt={user.name}
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
