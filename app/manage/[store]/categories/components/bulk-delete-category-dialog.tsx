"use client";

import { Row } from "@tanstack/react-table";

import { useState } from "react";
import { useDispatch } from "react-redux";
import { AppDispatch } from "@/redux/store";
import { bulkDelete } from "@/redux/slices/category";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

import { getErrorMessage } from "@/utils/get-error-message";
import { toast } from "sonner";

interface BulkDeleteCategoryDialogProps {
  rows: Row<Category>[];
}

export function BulkDeleteCategoryDialog({
  rows,
}: BulkDeleteCategoryDialogProps) {
  const dispatch = useDispatch<AppDispatch>();

  const totalItems = rows.reduce(
    (acc, row) => acc + (row.original.itemsCount || 0),
    0
  );

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleOpenChange = () => {
    if (loading && open) return;
    setOpen(!open);
  };

  const handleBulkDeleteCategory = async () => {
    setLoading(true);

    const result = await dispatch(
      bulkDelete(rows.map((row) => row.original.id))
    );

    if (bulkDelete.fulfilled.match(result)) {
      handleOpenChange();

      if (result.payload.failedDeletions.length > 0)
        toast.error(
          `Ocorreu um erro ao excluir ${
            result.payload.failedDeletions.length
          } categoria${
            result.payload.failedDeletions.length === 1 ? "" : "s"
          }. Por favor, tente novamente.`,
          {
            richColors: true,
            closeButton: true,
          }
        );
    }

    if (bulkDelete.rejected.match(result)) {
      toast.error(
        getErrorMessage(
          result.payload,
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
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger asChild>
        <Button
          size="icon"
          className="h-8 w-8"
          variant="ghost"
          disabled={!rows.length}
        >
          <Trash2 />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
          <AlertDialogDescription>
            {rows.length > 1 ? (
              <>
                Isso excluirá{" "}
                <span className="font-bold">
                  todas as {rows.length} categorias
                </span>
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
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleOpenChange} disabled={loading}>
            Cancelar
          </AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleBulkDeleteCategory}
            loading={loading}
          >
            {loading ? "Excluindo..." : "Excluir"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
