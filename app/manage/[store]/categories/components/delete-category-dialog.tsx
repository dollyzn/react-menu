"use client";

import { Row } from "@tanstack/react-table";

import { useState } from "react";
import { useDispatch } from "react-redux";
import { AppDispatch } from "@/redux/store";
import { destroy } from "@/redux/slices/category";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

import { getErrorMessage } from "@/utils/get-error-message";

interface DeleteCategoryDialogProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  row: Row<Category>;
}

export function DeleteCategoryDialog({
  open,
  onOpenChange,
  row,
}: DeleteCategoryDialogProps) {
  const dispatch = useDispatch<AppDispatch>();

  const [loading, setLoading] = useState(false);

  const handleOpenChange = () => {
    if (loading && open) return;
    onOpenChange(!open);
  };

  const handleDeleteCategory = async () => {
    setLoading(true);

    const result = await dispatch(destroy(row.original.id));

    if (destroy.fulfilled.match(result)) {
      handleOpenChange();
    }

    if (destroy.rejected.match(result)) {
      toast.error(
        getErrorMessage(
          result.payload,
          `Ocorreu um erro ao excluir a categoria ${row.getValue(
            "name"
          )}. Por favor, tente novamente.`
        ),
        {
          richColors: true,
          closeButton: true,
        }
      );
    }

    setLoading(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
          <AlertDialogDescription>
            Isso excluirá a categoria{" "}
            <span className="font-bold">{row.original.name}</span>
            {row.original.itemsCount && row.original.itemsCount > 0 ? (
              <>
                {" "}
                junto com todos os seus{" "}
                <span className="font-bold">
                  {row.original.itemsCount} itens
                </span>{" "}
                relacionados
              </>
            ) : (
              ""
            )}
            . Esta ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleOpenChange} disabled={loading}>
            Cancelar
          </AlertDialogCancel>

          <Button
            variant="destructive"
            onClick={handleDeleteCategory}
            loading={loading}
          >
            {loading ? "Excluindo..." : "Excluir"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
