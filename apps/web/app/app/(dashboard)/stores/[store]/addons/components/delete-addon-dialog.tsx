"use client";

import { Row } from "@tanstack/react-table";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { getErrorMessage } from "@/utils/get-error-message";
import { AlertDialogDestructive } from "@/components/app/alert-dialog-destructive";
import { useDeleteAddonByStoreIdMutation } from "@/redux/features/addon/addonApi";

interface DeleteAddonDialogProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  row: Row<Addon>;
}

export function DeleteAddonDialog({
  open,
  onOpenChange,
  row,
}: DeleteAddonDialogProps) {
  const { store } = useParams();
  const storeId = store as string;
  const [deleteAddon, { isLoading: isDeleting }] = useDeleteAddonByStoreIdMutation();

  const handleOpenChange = (nextOpen: boolean) => {
    if (isDeleting && open && !nextOpen) return;
    onOpenChange(nextOpen);
  };

  const handleDeleteAddon = async () => {
    try {
      await deleteAddon({ storeId, addonId: row.original.id }).unwrap();
      handleOpenChange(false);
    } catch (err: unknown) {
      toast.error(
        getErrorMessage(err, `Erro ao excluir adicional ${row.original.name}.`),
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
          Isso excluirá o adicional{" "}
          <span className="font-bold">{row.original.name}</span>. Esta ação não pode
          ser desfeita.
        </>
      }
      open={open}
      onOpenChange={handleOpenChange}
      loading={isDeleting}
      onConfirm={handleDeleteAddon}
    />
  );
}
