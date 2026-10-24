"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Row } from "@/components/app/data-table/features";
import { Edit, MoreHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { OptionGroup } from "@react-menu/contracts";
import { AlertDialogDestructive } from "@/components/app/alert-dialog-destructive";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDeleteOptionGroupMutation } from "@/redux/features/option-group/optionGroupApi";
import type { VariantProps } from "class-variance-authority";
import { OptionGroupDialog } from "./option-group-dialog";

/** Editar / Excluir of a choice group (table row and mobile card). */
export function RowActions({
  row,
  size = "icon",
}: {
  row: Row<OptionGroup>;
  size?: VariantProps<typeof buttonVariants>["size"];
}) {
  const { store } = useParams<{ store: string }>();
  const group = row.original;
  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [remove, { isLoading }] = useDeleteOptionGroupMutation();

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size={size} className="flex p-0 data-[state=open]:bg-muted" />}
        >
          <MoreHorizontal />
          <span className="sr-only">Abrir menu</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem onClick={() => setEditing(true)}>
            <Edit /> Editar
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => setRemoving(true)}>
            <Trash2 /> Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <OptionGroupDialog storeId={store} group={group} open={editing} onOpenChange={setEditing} />
      <AlertDialogDestructive
        open={removing}
        onOpenChange={setRemoving}
        loading={isLoading}
        title={`Excluir ${group.name}?`}
        description={
          group.itemsCount
            ? `${group.itemsCount === 1 ? "1 item deixa" : `${group.itemsCount} itens deixam`} de pedir essa escolha. Os adicionais continuam existindo.`
            : "Nenhum item usa este grupo. Os adicionais continuam existindo."
        }
        confirmLabel="Excluir"
        onConfirm={async () => {
          await remove({ storeId: store, id: group.id }).unwrap();
          toast.success("Grupo de escolha excluído");
          setRemoving(false);
        }}
      />
    </>
  );
}
