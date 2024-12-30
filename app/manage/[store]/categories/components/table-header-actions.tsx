"use client";

import { useState } from "react";
import { Table } from "@tanstack/react-table";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface HeaderActionsProps<Category> {
  table: Table<Category>;
}

export function HeaderActions({ table }: HeaderActionsProps<Category>) {
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const selectedRows = table.getSelectedRowModel().rows;
  const totalItems = selectedRows.reduce(
    (acc, row) => acc + (row.original.items?.length || 0),
    0
  );

  const handleDelete = () => {
    console.log(
      "Excluindo múltiplos itens:",
      selectedRows.map((r) => r.original)
    );

    setIsDeleteModalOpen(false);
  };

  return (
    <AlertDialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
      <AlertDialogTrigger asChild>
        <Button
          size="icon"
          className="h-8 w-8"
          variant="ghost"
          disabled={!selectedRows.length}
        >
          <Trash2 />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
          <AlertDialogDescription>
            {selectedRows.length > 1 ? (
              <>
                Isso excluirá{" "}
                <span className="font-bold">
                  todas as {selectedRows.length} categorias
                </span>{" "}
                selecionadas junto com todos os{" "}
                <span className="font-bold">{totalItems} itens</span>{" "}
                relacionados. Esta ação não pode ser desfeita.
              </>
            ) : (
              <>
                Isso excluirá a categoria{" "}
                <span className="font-bold">
                  {selectedRows[0]?.original.name}
                </span>{" "}
                junto com todos os seus{" "}
                <span className="font-bold">
                  {selectedRows[0]?.original.items?.length} itens
                </span>{" "}
                relacionados. Esta ação não pode ser desfeita.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setIsDeleteModalOpen(false)}>
            Cancelar
          </AlertDialogCancel>
          <Button variant="destructive" onClick={handleDelete}>
            Excluir
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
