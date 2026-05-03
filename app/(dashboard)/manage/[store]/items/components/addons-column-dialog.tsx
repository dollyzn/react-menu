"use client";

import { useState } from "react";
import { Row } from "@tanstack/react-table";
import { useGetAddonsByItemIdQuery } from "@/redux/features/addon/addonApi";

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

interface AddonsColumnDialogProps {
  row: Row<Item>;
}

export function AddonsColumnDialog({ row }: AddonsColumnDialogProps) {
  const [open, setOpen] = useState(false);
  const itemId = row.original.id;
  const { data: addons = [], isFetching } = useGetAddonsByItemIdQuery(itemId, {
    skip: !open,
  });

  const addonsCount = row.getValue("addonsCount") as number;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" disabled={isFetching && open}>
          {addonsCount || 0} Adiciona{addonsCount === 1 ? "l" : "is"}
          {isFetching && open ? (
            <Loader2 className="ml-2 h-4 w-4 animate-spin" />
          ) : (
            <ChevronDown className="ml-2 h-4 w-4" />
          )}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionais do Item</DialogTitle>
          <DialogDescription>
            Lista dos adicionais do item {row.getValue("name")}
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
            {addons && addons.length > 0 ? (
              addons.map((addon) => (
                <TableRow key={addon.id}>
                  <TableCell>{addon.name}</TableCell>
                  <TableCell>{addon.description}</TableCell>
                  <TableCell>{formatCurrencyBRL(addon.price)}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={3} className="text-center">
                  <div className="flex flex-col items-center justify-center py-4">
                    <Package className="h-8 w-8 text-muted-foreground mb-2" />
                    <span>Não há adicionais disponíveis para este item</span>
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
