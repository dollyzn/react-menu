import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "@/redux/store";
import { Row } from "@tanstack/react-table";

import { indexByCategory } from "@/redux/slices/item";

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
  const dispatch = useDispatch<AppDispatch>();

  const loading = useSelector(
    (state: RootState) => state.item.indexByCategory.loading
  );
  const items = useSelector(
    (state: RootState) => state.item.indexByCategory.data
  );

  const id = row.original.id;
  const itemsCount = row.getValue("itemsCount") as number;

  const [open, setOpen] = useState<boolean>(false);
  const [loadingCategory, setLoadingCategory] = useState<number>(0);

  async function handleToggleDialog() {
    if (loadingCategory !== 0) return;
    if (open) return setOpen(!open);

    setLoadingCategory(id);
    const result = await dispatch(indexByCategory(id));

    if (indexByCategory.fulfilled.match(result)) {
      setOpen(true);
    }
    setLoadingCategory(0);
  }

  return (
    <Dialog open={open} onOpenChange={handleToggleDialog}>
      <DialogTrigger asChild>
        <Button variant="ghost" disabled={loading}>
          {itemsCount} Itens
          {loadingCategory === id ? (
            <Loader2 className="ml-2 h-4 w-4 animate-spin" />
          ) : (
            <ChevronDown className="ml-2 h-4 w-4" />
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
