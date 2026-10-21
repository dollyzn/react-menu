"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import type { StoreRole } from "@react-menu/contracts";
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
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";
import { useAppSelector } from "@/redux/hooks";
import { useGetStoreByIdQuery } from "@/redux/features/store/storeApi";
import { useStoreRole } from "@/hooks/use-store-role";
import { hasPermission } from "@/lib/permissions";
import { homeForRole } from "@/lib/menu-itens";
import { cn } from "@/lib/utils";
import { CreateStoreDialog } from "./create-store-dialog";

const ROLE_LABEL: Record<StoreRole, string> = {
  manager: "Gerente",
  attendant: "Atendente",
  kitchen: "Cozinha",
};

function StoreLogo({ name, photoUrl, className }: { name: string; photoUrl?: string | null; className?: string }) {
  return (
    // One border only: the Avatar's own ring, made square like the logo.
    <Avatar className={cn("size-8 rounded-lg bg-background after:rounded-lg", className)}>
      {photoUrl && <AvatarImage src={photoUrl} alt="" className="rounded-lg object-contain p-0.5" />}
      <AvatarFallback className="rounded-lg bg-primary/10 text-xs font-bold text-primary">
        {name.slice(0, 2).toUpperCase()}
      </AvatarFallback>
    </Avatar>
  );
}

/** Store picker at the top of the sidebar (workspace-switcher style). */
export function StoreSwitcher() {
  const { store: storeId } = useParams<{ store?: string }>();
  const router = useRouter();
  const { isMobile } = useSidebar();
  const user = useAppSelector((state) => state.auth.user);
  const stores = user?.stores ?? [];
  const role = useStoreRole(storeId ?? "");
  const member = stores.find((s) => s.id === storeId);
  // Super admins may open stores they are not members of.
  const { data: fetched } = useGetStoreByIdQuery(storeId ?? "", { skip: !storeId || Boolean(member) });
  const current = member ?? fetched ?? stores[0];
  const [creating, setCreating] = React.useState(false);

  const roleLabel = member?.role ? ROLE_LABEL[member.role] : user?.superUser ? "Administrador" : role ? ROLE_LABEL[role] : "";

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <SidebarMenuButton
                  size="lg"
                  aria-label="Selecionar loja"
                  className="data-popup-open:bg-sidebar-accent data-popup-open:text-sidebar-accent-foreground"
                />
              }
            >
              {current ? (
                <StoreLogo name={current.name} photoUrl={current.photoUrl} />
              ) : (
                <span className="size-8 rounded-lg bg-muted" />
              )}
              <span className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{current?.name ?? "Selecione uma loja"}</span>
                {roleLabel && <span className="truncate text-xs text-muted-foreground">{roleLabel}</span>}
              </span>
              <ChevronsUpDown className="ml-auto size-4 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64 rounded-xl" side={isMobile ? "bottom" : "right"} align="start" sideOffset={4}>
              <DropdownMenuGroup>
                <DropdownMenuLabel className="text-xs text-muted-foreground">Lojas</DropdownMenuLabel>
                {stores.map((s) => (
                  <DropdownMenuItem key={s.id} onClick={() => router.push(homeForRole(s.id, s.role))} className="gap-2 p-2">
                    <StoreLogo name={s.name} photoUrl={s.photoUrl} className="size-7" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{s.name}</span>
                      <span className="block text-xs text-muted-foreground">{ROLE_LABEL[s.role]}</span>
                    </span>
                    {s.id === current?.id && <Check className="size-4 text-primary" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
              {hasPermission(user, "create_store") && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setCreating(true)} className="gap-2 p-2">
                    <span className="flex size-7 items-center justify-center rounded-md border border-dashed">
                      <Plus className="size-4" />
                    </span>
                    Criar loja
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>
      <CreateStoreDialog open={creating} onOpenChange={setCreating} />
    </>
  );
}
