"use client";

import { Row } from "@tanstack/react-table";
import { useState } from "react";
import { useParams } from "next/navigation";
import { useBulkDeleteAddonsByStoreIdMutation } from "@/redux/features/addon/addonApi";

import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

import { getErrorMessage } from "@/utils/get-error-message";
import { toast } from "sonner";
import { AlertDialogDestructive } from "@/components/app/alert-dialog-destructive";

interface BulkDeleteAddonDialogProps {
  rows: Row<Addon>[];
}

export function BulkDeleteAddonDialog({ rows }: BulkDeleteAddonDialogProps) {
  const { store } = useParams();
  const storeId = store as string;
  const [bulkDeleteAddonsByStoreId, { isLoading: isDeleting }] =
    useBulkDeleteAddonsByStoreIdMutation();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const busy = loading || isDeleting;

  const handleOpenChange = () => {
    if (busy && open) return;
    setOpen(!open);
  };

  const handleBulkDeleteAddonsByStoreId = async () => {
    setLoading(true);

    try {
      const result = await bulkDeleteAddonsByStoreId({
        storeId,
        ids: rows.map((row) => row.original.id),
      }).unwrap();
      rows.forEach((row) => {
        row.toggleSelected(false);
      });
      handleOpenChange();

      if (result.failedDeletions && result.failedDeletions.length > 0)
        toast.error(
          `Ocorreu um erro ao excluir ${
            result.failedDeletions.length
          } adicional${
            result.failedDeletions.length === 1 ? "" : "s"
          }. Por favor, tente novamente.`,
          {
            richColors: true,
            closeButton: true,
          }
        );
    } catch (err: unknown) {
      toast.error(
        getErrorMessage(
          err as { data?: { error?: string }; message?: string },
          `Ocorreu um erro ao excluir uma ou mais adicionais. Por favor, tente novamente.`
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
    <AlertDialogDestructive
      title="Tem certeza?"
      description={
        rows.length > 1 ? (
          <>
            Isso excluirá{" "}
            <span className="font-bold">todos os {rows.length} adicionais</span>{" "}
            selecionados. Esta ação não pode ser desfeita.
          </>
        ) : (
          <>
            Isso excluirá o adicional{" "}
            <span className="font-bold">{rows[0]?.original.name}</span>. Esta
            ação não pode ser desfeita.
          </>
        )
      }
      open={open}
      onOpenChange={handleOpenChange}
      loading={busy}
      onConfirm={handleBulkDeleteAddonsByStoreId}
    >
      <Button
        size="icon"
        className="h-8 w-8"
        variant="ghost"
        disabled={!rows.length}
      >
        <Trash2 />
      </Button>
    </AlertDialogDestructive>
  );
}
