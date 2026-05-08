"use client";

import { Row } from "@tanstack/react-table";
import { useState } from "react";
import { useParams } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getErrorMessage } from "@/utils/get-error-message";
import { AlertDialogDestructive } from "@/components/app/alert-dialog-destructive";
import { useBulkDeleteItemsByStoreIdMutation } from "@/redux/features/item/itemApi";

interface BulkDeleteItemDialogProps {
  rows: Row<Item>[];
}

export function BulkDeleteItemDialog({ rows }: BulkDeleteItemDialogProps) {
  const { store } = useParams();
  const storeId = store as string;
  const [bulkDeleteItems, { isLoading: isDeleting }] =
    useBulkDeleteItemsByStoreIdMutation();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const busy = loading || isDeleting;

  const handleOpenChange = (nextOpen: boolean) => {
    if (busy && open && !nextOpen) return;
    setOpen(nextOpen);
  };

  const handleBulkDelete = async () => {
    setLoading(true);
    try {
      const result = await bulkDeleteItems({
        storeId,
        ids: rows.map((row) => row.original.id),
      }).unwrap();

      rows.forEach((row) => row.toggleSelected(false));
      handleOpenChange(false);

      if (result.failedDeletions?.length) {
        toast.error(
          `Falha ao excluir ${result.failedDeletions.length} item(ns).`,
          {
            richColors: true,
            closeButton: true,
          }
        );
      }
    } catch (err: unknown) {
      toast.error(
        getErrorMessage(err, "Erro ao excluir itens selecionados."),
        {
          richColors: true,
          closeButton: true,
        }
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialogDestructive
      title="Tem certeza?"
      description={
        rows.length > 1 ? (
          <>
            Isso excluirá <span className="font-bold">{rows.length} itens</span>{" "}
            selecionados. Esta ação não pode ser desfeita.
          </>
        ) : (
          <>
            Isso excluirá o item{" "}
            <span className="font-bold">{rows[0]?.original.name}</span>. Esta ação não
            pode ser desfeita.
          </>
        )
      }
      open={open}
      onOpenChange={handleOpenChange}
      loading={busy}
      onConfirm={handleBulkDelete}
    >
      <Button size="icon" className="h-8 w-8" variant="ghost" disabled={!rows.length}>
        <Trash2 />
      </Button>
    </AlertDialogDestructive>
  );
}
