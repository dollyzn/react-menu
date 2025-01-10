import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "@/redux/store";
import { Row } from "@tanstack/react-table";

import { indexByItem } from "@/redux/slices/addon";

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
  const dispatch = useDispatch<AppDispatch>();

  const loading = useSelector(
    (state: RootState) => state.addon.indexByItem.loading
  );
  const addons = useSelector(
    (state: RootState) => state.addon.indexByItem.data
  );

  const id = row.original.id;
  const addonsCount = row.getValue("addonsCount") as number;

  const [open, setOpen] = useState<boolean>(false);
  const [loadingItem, setLoadingItem] = useState<string>("");

  async function handleToggleDialog() {
    if (loadingItem !== "") return;
    if (open) return setOpen(!open);

    setLoadingItem(id);
    const result = await dispatch(indexByItem(id));

    if (indexByItem.fulfilled.match(result)) {
      setOpen(true);
    }
    setLoadingItem("");
  }

  return (
    <Dialog open={open} onOpenChange={handleToggleDialog}>
      <DialogTrigger asChild>
        <Button variant="ghost" disabled={loading}>
          {addonsCount || 0} Adiciona{addonsCount === 1 ? "l" : "is"}
          {loadingItem === id ? (
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
