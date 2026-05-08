"use client";

import { Row } from "@tanstack/react-table";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { getErrorMessage } from "@/utils/get-error-message";
import { AlertDialogDestructive } from "@/components/app/alert-dialog-destructive";
import { useDeleteItemByStoreIdMutation } from "@/redux/features/item/itemApi";

interface DeleteItemDialogProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  row: Row<Item>;
}

export function DeleteItemDialog({
  open,
  onOpenChange,
  row,
}: DeleteItemDialogProps) {
  const { store } = useParams();
  const storeId = store as string;
  const [deleteItem, { isLoading: isDeleting }] = useDeleteItemByStoreIdMutation();

  const handleOpenChange = (nextOpen: boolean) => {
    if (isDeleting && open && !nextOpen) return;
    onOpenChange(nextOpen);
  };

  const handleDeleteItem = async () => {
    try {
      await deleteItem({ storeId, itemId: row.original.id }).unwrap();
      handleOpenChange(false);
    } catch (err: unknown) {
      toast.error(
        getErrorMessage(
          err,
          `Ocorreu um erro ao excluir o item ${row.original.name}.`
        ),
        { richColors: true, closeButton: true }
      );
    }
  };

  return (
    <AlertDialogDestructive
      title="Tem certeza?"
      description={
        <>
          Isso excluirá o item <span className="font-bold">{row.original.name}</span>.
          Esta ação não pode ser desfeita.
        </>
      }
      open={open}
      onOpenChange={handleOpenChange}
      loading={isDeleting}
      onConfirm={handleDeleteItem}
    />
  );
}
