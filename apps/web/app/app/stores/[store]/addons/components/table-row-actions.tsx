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
import { UpdateAddonDialog } from "./update-addon-dialog";
import { DeleteAddonDialog } from "./delete-addon-dialog";
import { VariantProps } from "class-variance-authority";

interface RowActionsProps<Addon> {
  row: Row<Addon>;
  size?: VariantProps<typeof buttonVariants>["size"];
}

export function RowActions({ row, size = "icon" }: RowActionsProps<Addon>) {
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

      <UpdateAddonDialog
        open={isEditModalOpen}
        onOpenChange={setIsEditModalOpen}
        row={row}
      />

      <DeleteAddonDialog
        open={isDeleteModalOpen}
        onOpenChange={setIsDeleteModalOpen}
        row={row}
      />
    </>
  );
}
