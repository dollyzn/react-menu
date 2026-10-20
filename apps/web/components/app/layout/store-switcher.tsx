"use client";

import * as React from "react";
import { useRouter, useParams } from "next/navigation";
import { BookmarkPlus, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAppSelector } from "@/redux/hooks";
import { hasPermission } from "@/lib/permissions";
import { CreateStoreDialog } from "./create-store-dialog";

type PopoverTriggerProps = React.ComponentPropsWithoutRef<
  typeof PopoverTrigger
>;

interface StoreSwitcherProps extends PopoverTriggerProps {
  className?: string;
}

export function StoreSwitcher({ className }: StoreSwitcherProps) {
  const { store } = useParams();
  const router = useRouter();
  const user = useAppSelector((state) => state.auth.user);
  const stores = user?.stores || [];
  const canCreateStore = hasPermission(user, "create_store");

  const [open, setOpen] = React.useState(false);
  const [showNewStoreDialog, setShowNewStoreDialog] = React.useState(false);

  const selectedStore = stores.find((s) => s.id === store) || stores[0];

  const handleStoreSelect = (next: Store) => {
    setOpen(false);
    router.push(`/app/stores/${next.id}`);
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              aria-label="Selecionar loja"
              className={cn("w-[200px] justify-between", className)}
            />
          }
        >
          <Avatar className="mr-2 h-5 w-5">
            <AvatarImage
              src={
                selectedStore?.photoUrl
                  ? selectedStore.photoUrl
                  : `https://avatar.vercel.sh/${selectedStore?.id}.png`
              }
              alt={selectedStore?.name || "Loja"}
              className="object-contain"
            />
            <AvatarFallback>LO</AvatarFallback>
          </Avatar>
          {selectedStore?.name || "Selecione uma loja"}
          <ChevronsUpDown className="ml-auto opacity-50" />
        </PopoverTrigger>
        <PopoverContent className="w-[200px] p-0">
          <Command>
            <CommandInput placeholder="Buscar loja..." />
            <CommandList>
              <CommandEmpty>Nenhuma loja encontrada.</CommandEmpty>
              <CommandGroup heading="Lojas">
                {stores.map((s) => (
                  <CommandItem
                    key={s.id}
                    value={s.id}
                    onSelect={() => handleStoreSelect(s)}
                    className="text-sm"
                    data-checked={selectedStore?.id === s.id}
                  >
                    <Avatar className="size-5">
                      <AvatarImage
                        src={
                          s.photoUrl
                            ? s.photoUrl
                            : `https://avatar.vercel.sh/${s.id}.png`
                        }
                        alt={s.name}
                        className="object-contain"
                      />
                      <AvatarFallback>LO</AvatarFallback>
                    </Avatar>
                    {s.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
            {canCreateStore && (
              <>
                <CommandSeparator />
                <CommandList>
                  <CommandGroup>
                    <CommandItem
                      onSelect={() => {
                        setOpen(false);
                        setShowNewStoreDialog(true);
                      }}
                    >
                      <BookmarkPlus className="size-5" />
                      Criar Loja
                    </CommandItem>
                  </CommandGroup>
                </CommandList>
              </>
            )}
          </Command>
        </PopoverContent>
      </Popover>
      <CreateStoreDialog
        open={showNewStoreDialog}
        onOpenChange={setShowNewStoreDialog}
      />
    </>
  );
}
