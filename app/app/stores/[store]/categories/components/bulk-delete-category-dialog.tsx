"use client";

import { Row } from "@tanstack/react-table";
import { useState } from "react";
import { useParams } from "next/navigation";
import { useBulkDeleteCategoriesMutation } from "@/redux/features/category/categoryApi";

import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

import { getErrorMessage } from "@/utils/get-error-message";
import { toast } from "sonner";
import { AlertDialogDestructive } from "@/components/app/alert-dialog-destructive";

interface BulkDeleteCategoryDialogProps {
  rows: Row<Category>[];
}

export function BulkDeleteCategoryDialog({
  rows,
}: BulkDeleteCategoryDialogProps) {
  const { store } = useParams();
  const storeId = store as string;
  const [bulkDelete, { isLoading: isDeleting }] =
    useBulkDeleteCategoriesMutation();

  const totalItems = rows.reduce(
    (acc, row) => acc + (row.original.itemsCount || 0),
    0
  );

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const busy = loading || isDeleting;

  const handleOpenChange = () => {
    if (busy && open) return;
    setOpen(!open);
  };

  const handleBulkDeleteCategory = async () => {
    setLoading(true);

    try {
      const result = await bulkDelete({
        storeId,
        ids: rows.map((row) => row.original.id),
      }).unwrap();
      handleOpenChange();

      if (result.failedDeletions && result.failedDeletions.length > 0)
        toast.error(
          `Ocorreu um erro ao excluir ${
            result.failedDeletions.length
          } categoria${
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
          `Ocorreu um erro ao excluir uma ou mais categorias. Por favor, tente novamente.`
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
            <span className="font-bold">todas as {rows.length} categorias</span>
            {totalItems > 0 ? (
              <>
                {" "}
                selecionadas junto com todos os{" "}
                <span className="font-bold">{totalItems} itens</span>{" "}
                relacionados
              </>
            ) : (
              ""
            )}
            . Esta ação não pode ser desfeita.
          </>
        ) : (
          <>
            Isso excluirá a categoria{" "}
            <span className="font-bold">{rows[0]?.original.name}</span>
            {rows[0]?.original.itemsCount &&
            rows[0]?.original.itemsCount > 0 ? (
              <>
                {" "}
                junto com todos os seus{" "}
                <span className="font-bold">
                  {rows[0]?.original.itemsCount} itens
                </span>{" "}
                relacionados
              </>
            ) : (
              ""
            )}
            . Esta ação não pode ser desfeita.
          </>
        )
      }
      open={open}
      onOpenChange={handleOpenChange}
      loading={busy}
      onConfirm={handleBulkDeleteCategory}
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
