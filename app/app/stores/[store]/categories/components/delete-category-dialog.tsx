"use client";

import { Row } from "@tanstack/react-table";
import { useParams } from "next/navigation";
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
import { AlertDialogDestructive } from "@/components/app/alert-dialog-destructive";
import { Trash2 } from "lucide-react";

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
  const { store } = useParams();
  const storeId = store as string;
  const [deleteCategory, { isLoading: isDeleting }] =
    useDeleteCategoryMutation();

  const handleOpenChange = () => {
    if (isDeleting && open) return;
    onOpenChange(!open);
  };

  const handleDeleteCategory = async () => {
    try {
      await deleteCategory({
        storeId,
        categoryId: row.original.id,
      }).unwrap();
      handleOpenChange();
    } catch (err: unknown) {
      toast.error(
        getErrorMessage(
          err,
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
    <AlertDialogDestructive
      title="Tem certeza?"
      description={
        <>
          Isso excluirá a categoria{" "}
          <span className="font-bold">{row.original.name}</span>. Esta ação não
          pode ser desfeita.
        </>
      }
      open={open}
      onOpenChange={handleOpenChange}
      loading={isDeleting}
      onConfirm={handleDeleteCategory}
    />
  );
}
