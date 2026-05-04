"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut } from "lucide-react";
import { useSession } from "@/contexts/session-provider";
import { useRouter } from "next/navigation";
import { redirectToLogout } from "@/utils/navigation";
import { ModeSwitcher } from "./mode-switcher";

export function HeaderUser() {
  const router = useRouter();
  const { user } = useSession();

  async function handleLogout() {
    redirectToLogout(router);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="relative h-8 w-8 rounded-full bg-background/30 hover:bg-background/60"
        >
          <Avatar className="h-8 w-8 rounded-full">
            <AvatarImage
              src={`https://api.dicebear.com/9.x/lorelei/svg?seed=${user?.name ?? "user"}`}
              alt="Usuário"
            />
            <AvatarFallback>
              {user?.name?.substring(0, 2)?.toUpperCase() ?? "US"}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-56 rounded-lg" align="end">
        <DropdownMenuLabel className="font-normal">
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-medium">{user?.name}</span>
            <span className="truncate text-xs text-muted-foreground">
              {user?.email}
            </span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <ModeSwitcher />
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
