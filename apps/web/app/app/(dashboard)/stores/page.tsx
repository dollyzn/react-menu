"use client";

import { useState } from "react";
import { redirect } from "next/navigation";
import { BookmarkPlus, Store as StoreIcon } from "lucide-react";
import { useSession } from "@/contexts/session-provider";
import { hasPermission } from "@/lib/permissions";
import { homeForRole } from "@/lib/menu-itens";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { CreateStoreDialog } from "@/components/app/layout/create-store-dialog";

export default function Stores() {
  const { user } = useSession();
  const [creating, setCreating] = useState(false);
  const stores = user?.stores || [];

  if (stores.length > 0) {
    return redirect(homeForRole(stores[0].id, stores[0].role));
  }

  // A user with no linked store (e.g. a fresh install) lands here instead of
  // being sent away, so admins can create the first store.
  const canCreateStore = hasPermission(user, "create_store");

  return (
    <Empty className="min-h-[calc(100svh-3rem)]">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <StoreIcon />
        </EmptyMedia>
        <EmptyTitle>Nenhuma loja por aqui</EmptyTitle>
        <EmptyDescription>
          {canCreateStore
            ? "Crie sua primeira loja para começar a montar o cardápio."
            : "Sua conta ainda não está vinculada a nenhuma loja. Peça a um administrador para adicionar você."}
        </EmptyDescription>
      </EmptyHeader>
      {canCreateStore && (
        <EmptyContent>
          <Button onClick={() => setCreating(true)}>
            <BookmarkPlus /> Criar loja
          </Button>
          <CreateStoreDialog open={creating} onOpenChange={setCreating} />
        </EmptyContent>
      )}
    </Empty>
  );
}
