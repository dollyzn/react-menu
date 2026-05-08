"use client";

import { useState } from "react";
import { Row } from "@tanstack/react-table";
import { MoreHorizontal, Edit, Trash2 } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { UpdateItemDialog } from "./update-item-dialog";
import { DeleteItemDialog } from "./delete-item-dialog";
import { VariantProps } from "class-variance-authority";

interface RowActionsProps<Item> {
  row: Row<Item>;
  size?: VariantProps<typeof buttonVariants>["size"];
}

export function RowActions({ row, size = "icon" }: RowActionsProps<Item>) {
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size={size}
              className="flex p-0 data-[state=open]:bg-muted"
            />
          }
        >
          <MoreHorizontal />
          <span className="sr-only">Abrir menu</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[160px]">
          <DropdownMenuItem onClick={() => setIsEditModalOpen(true)}>
            <Edit className="mr-2 h-4 w-4 text-blue-500" />
            Editar
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setIsDeleteModalOpen(true)}>
            <Trash2 className="mr-2 h-4 w-4 text-red-500" />
            Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <UpdateItemDialog
        open={isEditModalOpen}
        onOpenChange={setIsEditModalOpen}
        row={row}
      />

      <DeleteItemDialog
        open={isDeleteModalOpen}
        onOpenChange={setIsDeleteModalOpen}
        row={row}
      />
    </>
  );
}
