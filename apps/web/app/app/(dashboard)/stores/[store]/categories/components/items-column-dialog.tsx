"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Row } from "@tanstack/react-table";
import { useGetItemsByCategoryIdQuery, useUpdateItemMutation } from "@/redux/features/item/itemApi";

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
import Link from "next/link";
import { toast } from "sonner";
import { ArrowRight, ChevronDown, ImageOff, Loader2, Package } from "lucide-react";
import Image from "@/components/app/image";
import { SearchInput } from "@/components/app/search-input";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { normalizeSearch } from "@/utils/string";

import { formatCurrencyBRL } from "@/utils/string";

interface ItemsColumnDialogProps {
  row: Row<Category>;
}

export function ItemsColumnDialog({ row }: ItemsColumnDialogProps) {
  const { store } = useParams();
  const storeId = store as string;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [updateItem] = useUpdateItemMutation();
  const categoryId = row.original.id;
  const { data: items = [], isFetching } = useGetItemsByCategoryIdQuery(
    { storeId, categoryId },
    { skip: !open }
  );

  const itemsCount = row.getValue("itemsCount") as number;

  const term = normalizeSearch(query);
  const visible = items.filter((item) => !term || normalizeSearch(item.name).includes(term));
  const categoryName = row.original.name;

  const toggleAvailability = async (item: Item) => {
    await updateItem({ storeId, itemId: item.id, data: { isAvailable: !item.isAvailable } }).unwrap();
    toast.success(item.isAvailable ? `${item.name} marcado como esgotado` : `${item.name} disponível de novo`);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="secondary" disabled={isFetching && open} />}>
        {itemsCount || 0} Ite{itemsCount === 1 ? "m" : "ns"}
        {isFetching && open ? <Loader2 className="size-4 animate-spin" /> : <ChevronDown className="size-4" />}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{categoryName}</DialogTitle>
          <DialogDescription>
            {items.length} {items.length === 1 ? "item" : "itens"} ·{" "}
            {items.filter((item) => !item.isAvailable).length} esgotado(s)
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-3">
          {items.length > 6 && (
            <SearchInput value={query} onValueChange={setQuery} placeholder="Buscar nesta categoria" aria-label="Buscar item na categoria" />
          )}
          {isFetching && items.length === 0 ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-16 rounded-xl" />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
              <Package className="size-8" />
              {items.length === 0 ? "Nenhum item nesta categoria ainda." : "Nenhum item encontrado."}
            </div>
          ) : (
            <ul className="divide-y rounded-xl border">
              {visible.map((item) => (
                <li key={item.id} className={cn("flex items-center gap-3 p-2.5", !item.isAvailable && "bg-muted/40")}>
                  <div className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                    {item.photoUrl ? (
                      <Image src={item.photoUrl} alt="" fill sizes="48px" className={cn("object-cover", !item.isAvailable && "grayscale")} />
                    ) : (
                      <ImageOff className="absolute top-1/2 left-1/2 size-4 -translate-1/2 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.name}</p>
                    {item.description && <p className="truncate text-xs text-muted-foreground">{item.description}</p>}
                    <p className="text-sm font-semibold tabular-nums text-primary">{formatCurrencyBRL(item.price)}</p>
                  </div>
                  <label className="flex shrink-0 cursor-pointer flex-col items-center gap-1 text-[11px] text-muted-foreground">
                    <Switch
                      checked={item.isAvailable}
                      onCheckedChange={() => void toggleAvailability(item)}
                      aria-label={`${item.name}: ${item.isAvailable ? "disponível" : "esgotado"}`}
                    />
                    {item.isAvailable ? "Disponível" : "Esgotado"}
                  </label>
                </li>
              ))}
            </ul>
          )}
        </DialogBody>
        <DialogFooter>
          <Link
            href={`/app/stores/${storeId}/items?f.category.name[]=${encodeURIComponent(categoryName)}`}
            className={buttonVariants({ variant: "outline" })}
          >
            Abrir em Itens <ArrowRight />
          </Link>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
