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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAppSelector } from "@/redux/hooks";

type PopoverTriggerProps = React.ComponentPropsWithoutRef<
  typeof PopoverTrigger
>;

interface StoreSwitcherProps extends PopoverTriggerProps {
  className?: string;
}

export function StoreSwitcher({ className }: StoreSwitcherProps) {
  const { store } = useParams();
  const router = useRouter();
  const stores = useAppSelector((state) => state.auth.user?.stores || []);

  const [open, setOpen] = React.useState(false);
  const [showNewTeamDialog, setShowNewTeamDialog] = React.useState(false);

  const selectedStore = stores.find((s) => s.id === store) || stores[0];

  const handleStoreSelect = (next: Store) => {
    setOpen(false);
    router.push(`/app/stores/${next.id}`);
  };

  return (
    <Dialog open={showNewTeamDialog} onOpenChange={setShowNewTeamDialog}>
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
            <CommandSeparator />
            <CommandList>
              <CommandGroup>
                <DialogTrigger
                  render={
                    <CommandItem
                      onSelect={() => {
                        setOpen(false);
                        setShowNewTeamDialog(true);
                      }}
                    />
                  }
                >
                  <BookmarkPlus className="size-5" />
                  Criar Loja
                </DialogTrigger>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Criar Loja</DialogTitle>
          <DialogDescription>
            Criar uma nova loja para gerenciar suas categorias e itens.
          </DialogDescription>
        </DialogHeader>
        <div>
          <div className="space-y-4 py-2 pb-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input id="name" placeholder="Nome da loja" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowNewTeamDialog(false)}>
            Cancelar
          </Button>
          <Button type="submit">Continuar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
