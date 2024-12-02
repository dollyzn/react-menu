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

interface HeaderActionsProps<Item> {
  table: Table<Item>;
}

export function HeaderActions({ table }: HeaderActionsProps<Item>) {
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const selectedRows = table.getSelectedRowModel().rows;

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
                Isso excluirá todos os{" "}
                <span className="font-bold">{selectedRows.length} itens</span>{" "}
                selecionados. Esta ação não pode ser desfeita.
              </>
            ) : (
              <>
                Isso excluirá o item{" "}
                <span className="font-bold">
                  {selectedRows[0]?.original.name}
                </span>
                . Esta ação não pode ser desfeita.
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
