"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { ListChecks, Pencil, Plus, Trash2 } from "lucide-react";
import type { OptionGroup } from "@react-menu/contracts";
import { AlertDialogDestructive } from "@/components/app/alert-dialog-destructive";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useDeleteOptionGroupMutation,
  useGetOptionGroupsQuery,
} from "@/redux/features/option-group/optionGroupApi";
import { formatCurrencyBRL } from "@/utils/string";
import { ManagementPageShell } from "../components/management-page-shell";
import { OptionGroupDialog, groupRule } from "./option-group-dialog";

/** Choice groups ("Escolha o queijo"): created here, attached on each item. */
export default function OptionGroupsPage() {
  const { store } = useParams<{ store: string }>();
  const { data: groups = [], isLoading } = useGetOptionGroupsQuery(store);
  const [remove, { isLoading: removing }] = useDeleteOptionGroupMutation();
  const [editing, setEditing] = useState<OptionGroup | null>(null);
  const [creating, setCreating] = useState(false);
  const [toRemove, setToRemove] = useState<OptionGroup | null>(null);

  return (
    <ManagementPageShell
      storeId={store}
      pageLabel="Grupos de escolha"
      description="Escolhas que o cliente faz ao pedir, como o queijo do pastel ou até 2 molhos. Depois, ligue o grupo nos itens."
      action={
        <Button variant="outline" onClick={() => setCreating(true)}>
          <Plus /> Criar grupo
        </Button>
      }
    >
      <ul aria-label="Grupos de escolha" aria-busy={isLoading} className="grid gap-3 md:grid-cols-2">
        {isLoading &&
          Array.from({ length: 2 }).map((_, index) => (
            <li key={index}>
              <Skeleton className="h-28 w-full rounded-xl" />
            </li>
          ))}
        {!isLoading && groups.length === 0 && (
          <li className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground md:col-span-2">
            <ListChecks className="size-8" />
            Nenhum grupo ainda. Crie um, por exemplo “Escolha o queijo” com as opções de queijo.
          </li>
        )}
        {groups.map((group) => (
          <li key={group.id} aria-label={group.name} className="rounded-xl border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium">{group.name}</p>
                <Badge variant={group.minChoices > 0 ? "default" : "secondary"} className="mt-1">
                  {groupRule(group)}
                </Badge>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon-sm" aria-label={`Editar ${group.name}`} onClick={() => setEditing(group)}>
                  <Pencil />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground hover:text-destructive"
                  aria-label={`Excluir ${group.name}`}
                  onClick={() => setToRemove(group)}
                >
                  <Trash2 />
                </Button>
              </div>
            </div>
            <ul aria-label={`Opções de ${group.name}`} className="mt-3 flex flex-wrap gap-1.5">
              {group.options?.map((option) => (
                <li key={option.id} className="rounded-full bg-muted px-2.5 py-1 text-xs">
                  {option.name}{" "}
                  <span className="text-muted-foreground">
                    {option.price ? `+ ${formatCurrencyBRL(option.price)}` : "incluso"}
                  </span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>

      <OptionGroupDialog
        storeId={store}
        group={editing}
        open={creating || Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) {
            setCreating(false);
            setEditing(null);
          }
        }}
      />
      <AlertDialogDestructive
        open={Boolean(toRemove)}
        onOpenChange={(open) => !open && setToRemove(null)}
        loading={removing}
        title={`Excluir ${toRemove?.name}?`}
        description="Os itens que usam este grupo deixam de pedir essa escolha. Os adicionais continuam existindo."
        confirmLabel="Excluir"
        onConfirm={async () => {
          if (!toRemove) return;
          await remove({ storeId: store, id: toRemove.id }).unwrap();
          toast.success("Grupo de escolha excluído");
          setToRemove(null);
        }}
      />
    </ManagementPageShell>
  );
}
