"use client";

import { useState } from "react";
import { Row } from "@/components/app/data-table/features";
import { MoreHorizontal, Edit, Trash2, CookingPot, CircleSlash, CircleCheck } from "lucide-react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { useUpdateItemMutation } from "@/redux/features/item/itemApi";

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
import { RecipeDialog } from "./recipe-dialog";
import { VariantProps } from "class-variance-authority";

interface RowActionsProps {
  row: Row<Item>;
  size?: VariantProps<typeof buttonVariants>["size"];
}

export function RowActions({ row, size = "icon" }: RowActionsProps) {
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isRecipeOpen, setIsRecipeOpen] = useState(false);
  const { store: storeId } = useParams<{ store: string }>();
  const [updateItem] = useUpdateItemMutation();
  const item = row.original;

  const toggleAvailability = async () => {
    await updateItem({ storeId, itemId: item.id, data: { isAvailable: !item.isAvailable } }).unwrap();
    toast.success(item.isAvailable ? `${item.name} marcado como esgotado` : `${item.name} disponível de novo`);
  };

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
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem onClick={() => setIsEditModalOpen(true)}>
            <Edit />
            Editar
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setIsRecipeOpen(true)}>
            <CookingPot />
            Receita
          </DropdownMenuItem>
          <DropdownMenuItem onClick={toggleAvailability}>
            {item.isAvailable ? (
              <CircleSlash />
            ) : (
              <CircleCheck />
            )}
            {item.isAvailable ? "Marcar esgotado" : "Marcar disponível"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => setIsDeleteModalOpen(true)}>
            <Trash2 />
            Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <UpdateItemDialog
        open={isEditModalOpen}
        onOpenChange={setIsEditModalOpen}
        row={row}
      />

      <RecipeDialog
        item={row.original}
        open={isRecipeOpen}
        onOpenChange={setIsRecipeOpen}
      />

      <DeleteItemDialog
        open={isDeleteModalOpen}
        onOpenChange={setIsDeleteModalOpen}
        row={row}
      />
    </>
  );
}
