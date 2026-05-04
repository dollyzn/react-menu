"use client";

import { Row } from "@tanstack/react-table";
import { useDeleteCategoryMutation } from "@/redux/features/category/categoryApi";
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
  const [deleteCategory, { isLoading: isDeleting }] =
    useDeleteCategoryMutation();

  const handleOpenChange = () => {
    if (isDeleting && open) return;
    onOpenChange(!open);
  };

  const handleDeleteCategory = async () => {
    try {
      await deleteCategory(row.original.id).unwrap();
      handleOpenChange();
    } catch (err: unknown) {
      toast.error(
        getErrorMessage(
          err as { data?: { error?: string }; message?: string },
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
          <AlertDialogCancel onClick={handleOpenChange} disabled={isDeleting}>
            Cancelar
          </AlertDialogCancel>

          <Button
            variant="destructive"
            onClick={handleDeleteCategory}
            loading={isDeleting}
          >
            {isDeleting ? "Excluindo..." : "Excluir"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
