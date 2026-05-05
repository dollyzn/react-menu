"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Row } from "@tanstack/react-table";
import { useGetItemsByCategoryIdQuery } from "@/redux/features/item/itemApi";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ChevronDown, Loader2, Package } from "lucide-react";

import { formatCurrencyBRL } from "@/utils/string";

interface ItemsColumnDialogProps {
  row: Row<Category>;
}

export function ItemsColumnDialog({ row }: ItemsColumnDialogProps) {
  const { store } = useParams();
  const storeId = store as string;
  const [open, setOpen] = useState(false);
  const categoryId = row.original.id;
  const { data: items = [], isFetching } = useGetItemsByCategoryIdQuery(
    { storeId, categoryId },
    { skip: !open }
  );

  const itemsCount = row.getValue("itemsCount") as number;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" disabled={isFetching && open}>
          {itemsCount || 0} Ite{itemsCount === 1 ? "m" : "ns"}
          {isFetching && open ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ChevronDown className="size-4" />
          )}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Itens da Categoria</DialogTitle>
          <DialogDescription>
            Lista dos itens da categoria {row.getValue("name")}
          </DialogDescription>
        </DialogHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Valor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items && items.length > 0 ? (
              items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.name}</TableCell>
                  <TableCell>{item.description}</TableCell>
                  <TableCell>{formatCurrencyBRL(item.price)}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={3} className="text-center">
                  <div className="flex flex-col items-center justify-center py-4">
                    <Package className="h-8 w-8 text-muted-foreground mb-2" />
                    <span>Não foram criados itens para esta categoria</span>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </DialogContent>
    </Dialog>
  );
}
