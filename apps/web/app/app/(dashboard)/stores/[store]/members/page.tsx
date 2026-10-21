"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { MailPlus, UserMinus, Users } from "lucide-react";
import type { StoreMember, StoreRole } from "@react-menu/contracts";
import { AlertDialogDestructive } from "@/components/app/alert-dialog-destructive";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppSelector } from "@/redux/hooks";
import {
  useGetMembersQuery,
  useRemoveMemberMutation,
  useResendInviteMutation,
  useUpdateMemberRoleMutation,
} from "@/redux/features/store/membersApi";
import { ManagementPageShell } from "../components/management-page-shell";
import { AddMemberDialog } from "./add-member-dialog";
import { ROLE_ITEMS, ROLES } from "./roles";

const initials = (member: StoreMember) =>
  (member.name ?? member.email)
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");

export default function MembersPage() {
  const { store: storeId } = useParams<{ store: string }>();
  const me = useAppSelector((state) => state.auth.user?.id);
  const { data: members = [], isLoading } = useGetMembersQuery(storeId);
  const [updateRole] = useUpdateMemberRoleMutation();
  const [remove, { isLoading: removing }] = useRemoveMemberMutation();
  const [resendInvite, resending] = useResendInviteMutation();
  const [toRemove, setRemoving] = useState<StoreMember | null>(null);

  const changeRole = async (member: StoreMember, role: StoreRole) => {
    if (role === member.role) return;
    try {
      await updateRole({ storeId, userId: member.id, role }).unwrap();
      toast.success(`${member.name ?? member.email} agora é ${ROLES[role].label.toLowerCase()}`);
    } catch {
      // baseApi shows the reason (e.g. the last manager).
    }
  };

  const resend = async (member: StoreMember) => {
    try {
      await resendInvite({ storeId, userId: member.id }).unwrap();
      toast.success(`Convite reenviado para ${member.email}`);
    } catch {
      // baseApi shows the reason.
    }
  };

  return (
    <ManagementPageShell
      storeId={storeId}
      pageLabel="Equipe"
      description="Quem acessa o painel desta loja e o que cada pessoa pode fazer."
      action={<AddMemberDialog storeId={storeId} />}
    >
      <ul className="divide-y rounded-2xl border bg-card" aria-label="Membros da equipe" aria-busy={isLoading}>
        {isLoading &&
          Array.from({ length: 3 }).map((_, index) => (
            <li key={index} className="p-4">
              <Skeleton className="h-10 w-full" />
            </li>
          ))}
        {!isLoading && members.length === 0 && (
          <li className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground">
            <Users className="size-8" />
            Ninguém na equipe ainda.
          </li>
        )}
        {members.map((member) => {
          const isMe = member.id === me;
          const Icon = ROLES[member.role].icon;
          return (
            <li key={member.id} className="flex flex-wrap items-center gap-3 p-4" aria-label={member.name ?? member.email}>
              <span
                aria-hidden
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary"
              >
                {initials(member)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 truncate font-medium">
                  {member.name ?? member.email}
                  {isMe && <Badge variant="secondary">Você</Badge>}
                  {member.invitePending && <Badge variant="outline">Convite pendente</Badge>}
                </p>
                <p className="truncate text-sm text-muted-foreground">{member.email}</p>
              </div>
              <Select
                items={ROLE_ITEMS}
                value={member.role}
                onValueChange={(value) => void changeRole(member, value as StoreRole)}
              >
                <SelectTrigger className="w-40" aria-label={`Função de ${member.name ?? member.email}`}>
                  <Icon className="text-muted-foreground" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_ITEMS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {member.invitePending && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={resending.isLoading && resending.originalArgs?.userId === member.id}
                  onClick={() => void resend(member)}
                >
                  <MailPlus /> Reenviar convite
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground hover:text-destructive"
                aria-label={`Remover ${member.name ?? member.email} da equipe`}
                onClick={() => setRemoving(member)}
              >
                <UserMinus />
              </Button>
            </li>
          );
        })}
      </ul>

      <dl className="grid gap-3 text-sm sm:grid-cols-3">
        {(Object.keys(ROLES) as StoreRole[]).map((role) => {
          const { label, description, icon: Icon } = ROLES[role];
          return (
            <div key={role} className="rounded-xl border bg-card p-3">
              <dt className="flex items-center gap-2 font-medium">
                <Icon className="size-4 text-primary" /> {label}
              </dt>
              <dd className="mt-1 text-muted-foreground">{description}</dd>
            </div>
          );
        })}
      </dl>

      <AlertDialogDestructive
        open={Boolean(toRemove)}
        onOpenChange={(open) => !open && setRemoving(null)}
        loading={removing}
        title={`Remover ${toRemove?.name ?? toRemove?.email} da equipe?`}
        description={
          toRemove?.id === me
            ? "Você perde o acesso a esta loja na hora."
            : "A pessoa perde o acesso a esta loja na hora. A conta continua existindo."
        }
        confirmLabel="Remover"
        onConfirm={async () => {
          if (!toRemove) return;
          try {
            await remove({ storeId, userId: toRemove.id }).unwrap();
            toast.success("Removido da equipe");
          } catch {
            // baseApi shows the reason (e.g. the last manager).
          }
          setRemoving(null);
        }}
      />
    </ManagementPageShell>
  );
}
