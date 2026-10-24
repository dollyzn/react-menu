"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Row } from "@/components/app/data-table/features";
import { toast } from "sonner";
import { ArrowRight, ChevronDown, ImageOff, Loader2, PlusCircle } from "lucide-react";
import {
  useGetAddonsByItemIdQuery,
  useUpdateAddonByStoreIdMutation,
} from "@/redux/features/addon/addonApi";

import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import Image from "@/components/app/image";
import { SearchInput } from "@/components/app/search-input";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { formatCurrencyBRL, normalizeSearch } from "@/utils/string";

interface AddonsColumnDialogProps {
  row: Row<Item>;
  /** Trigger size; tables pass the one for their row density. */
  size?: React.ComponentProps<typeof Button>["size"];
}

export function AddonsColumnDialog({ row, size }: AddonsColumnDialogProps) {
  const { store } = useParams();
  const storeId = store as string;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [updateAddon] = useUpdateAddonByStoreIdMutation();
  const itemId = row.original.id;
  const itemName = row.original.name;
  const { data: addons = [], isFetching } = useGetAddonsByItemIdQuery(
    { storeId, itemId },
    { skip: !open }
  );

  const addonsCount = row.getValue("addonsCount") as number;

  const term = normalizeSearch(query);
  const visible = addons.filter((addon) => !term || normalizeSearch(addon.name).includes(term));
  const soldOut = addons.filter((addon) => !addon.isAvailable).length;

  const toggleAvailability = async (addon: Addon) => {
    await updateAddon({ storeId, addonId: addon.id, data: { isAvailable: !addon.isAvailable } }).unwrap();
    toast.success(addon.isAvailable ? `${addon.name} marcado como esgotado` : `${addon.name} disponível de novo`);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size={size} disabled={isFetching && open} />}>
        {addonsCount || 0} Adiciona{addonsCount === 1 ? "l" : "is"}
        {isFetching && open ? <Loader2 className="animate-spin" /> : <ChevronDown />}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Adicionais de {itemName}</DialogTitle>
          <DialogDescription>
            {addons.length} {addons.length === 1 ? "adicional" : "adicionais"} · {soldOut} esgotado(s).
            Esgotar um adicional vale para todos os itens que o oferecem.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-3">
          {addons.length > 6 && (
            <SearchInput value={query} onValueChange={setQuery} placeholder="Buscar adicional" aria-label="Buscar adicional do item" />
          )}
          {isFetching && addons.length === 0 ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-16 rounded-xl" />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
              <PlusCircle className="size-8" />
              {addons.length === 0
                ? "Este item ainda não oferece adicionais. Vincule-os na edição do item."
                : "Nenhum adicional encontrado."}
            </div>
          ) : (
            <ul className="divide-y rounded-xl border">
              {visible.map((addon) => (
                <li key={addon.id} className={cn("flex items-center gap-3 p-2.5", !addon.isAvailable && "bg-muted/40")}>
                  <div className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                    {addon.photoUrl ? (
                      <Image src={addon.photoUrl} alt="" fill sizes="48px" className={cn("object-cover", !addon.isAvailable && "grayscale")} />
                    ) : (
                      <ImageOff className="absolute top-1/2 left-1/2 size-4 -translate-1/2 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{addon.name}</p>
                    {addon.description && <p className="truncate text-xs text-muted-foreground">{addon.description}</p>}
                    <p className="text-sm font-semibold tabular-nums text-primary">+ {formatCurrencyBRL(addon.price)}</p>
                  </div>
                  <label className="flex shrink-0 cursor-pointer flex-col items-center gap-1 text-[11px] text-muted-foreground">
                    <Switch
                      checked={addon.isAvailable}
                      onCheckedChange={() => void toggleAvailability(addon)}
                      aria-label={`${addon.name}: ${addon.isAvailable ? "disponível" : "esgotado"}`}
                    />
                    {addon.isAvailable ? "Disponível" : "Esgotado"}
                  </label>
                </li>
              ))}
            </ul>
          )}
        </DialogBody>
        <DialogFooter>
          <Link href={`/app/stores/${storeId}/addons`} className={buttonVariants({ variant: "outline" })}>
            Abrir em Adicionais <ArrowRight />
          </Link>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
