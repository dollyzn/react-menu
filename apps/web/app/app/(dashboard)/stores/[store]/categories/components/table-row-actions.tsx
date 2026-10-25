"use client";

import { useState } from "react";
import { Row } from "@/components/app/data-table/features";
import { MoreHorizontal, Edit, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UpdateCategoryDialog } from "./update-category-dialog";
import { DeleteCategoryDialog } from "./delete-category-dialog";

interface RowActionsProps {
  row: Row<Category>;
}

export function RowActions({ row }: RowActionsProps) {
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              className="flex size-8 p-0 data-[state=open]:bg-muted"
            />
          }
        >
          <MoreHorizontal />
          <span className="sr-only">Abrir menu</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem onClick={() => setIsEditModalOpen(true)}>
            <Edit />
            Editar
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => setIsDeleteModalOpen(true)}>
            <Trash2 />
            Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <UpdateCategoryDialog
        open={isEditModalOpen}
        onOpenChange={setIsEditModalOpen}
        row={row}
      />

      <DeleteCategoryDialog
        open={isDeleteModalOpen}
        onOpenChange={setIsDeleteModalOpen}
        row={row}
      />
    </>
  );
}
