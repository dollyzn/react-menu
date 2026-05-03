"use client";

import * as React from "react";
import { useRouter, useParams } from "next/navigation";
import { Check, ChevronsUpDown, PlusCircle } from "lucide-react";
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

  const defaultStore = stores.find((s) => s.id === store) || stores[0];
  const [selectedStore, setSelectedStore] = React.useState<Store | undefined>(
    defaultStore
  );

  React.useEffect(() => {
    if (selectedStore?.id !== defaultStore?.id) {
      setSelectedStore(defaultStore);
    } else if (selectedStore) {
      const updatedStore = stores.find((s) => s.id === selectedStore.id);
      if (updatedStore && updatedStore.photoUrl !== selectedStore.photoUrl) {
        setSelectedStore((prev) =>
          prev
            ? {
                ...prev,
                photoUrl: updatedStore.photoUrl,
              }
            : undefined
        );
      }
    }
  }, [store, stores, defaultStore, selectedStore]);

  const handleStoreSelect = (next: Store) => {
    setSelectedStore(next);
    setOpen(false);
    router.push(`/manage/${next.id}`);
  };

  return (
    <Dialog open={showNewTeamDialog} onOpenChange={setShowNewTeamDialog}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label="Selecionar loja"
            className={cn("w-[200px] justify-between", className)}
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
          </Button>
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
                  >
                    <Avatar className="mr-2 h-5 w-5">
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
                    <Check
                      className={cn(
                        "ml-auto",
                        selectedStore?.id === s.id
                          ? "opacity-100"
                          : "opacity-0"
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
            <CommandSeparator />
            <CommandList>
              <CommandGroup>
                <DialogTrigger asChild>
                  <CommandItem
                    onSelect={() => {
                      setOpen(false);
                      setShowNewTeamDialog(true);
                    }}
                  >
                    <PlusCircle className="h-5 w-5" />
                    Criar Loja
                  </CommandItem>
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
