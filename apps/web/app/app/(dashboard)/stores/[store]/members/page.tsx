"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { LogOut, ShieldOff, Users } from "lucide-react";
import type { StoreMember, StoreRole } from "@react-menu/contracts";
import { AlertDialogDestructive } from "@/components/app/alert-dialog-destructive";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useAppSelector } from "@/redux/hooks";
import {
  useGetMembersQuery,
  useRemoveMemberMutation,
  useResendInviteMutation,
  useRevokeMemberSessionsMutation,
  useSetMemberAccessMutation,
  useUpdateMemberRoleMutation,
} from "@/redux/features/store/membersApi";
import { ManagementPageShell } from "../components/management-page-shell";
import { AddMemberDialog } from "./add-member-dialog";
import { MemberRow, memberName, type MemberActions } from "./member-row";
import { ROLES } from "./roles";
import { useLastValue } from "@/hooks/use-last-value";

type Confirm = { kind: "remove" | "disable" | "sessions"; member: StoreMember };

/** Online status comes from the panel's heartbeat; refresh it while the page is open. */
const REFRESH_MS = 30_000;

/** A clock for "visto há…" (client only: the list loads after hydration). */
function useNow(every = 60_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), every);
    return () => window.clearInterval(timer);
  }, [every]);
  return now;
}

export default function MembersPage() {
  const { store: storeId } = useParams<{ store: string }>();
  const me = useAppSelector((state) => state.auth.user?.id);
  const { data: members = [], isLoading, fulfilledTimeStamp } = useGetMembersQuery(storeId, {
    pollingInterval: REFRESH_MS,
  });
  const clock = useNow();
  // A fresh list also moves the clock (online/last seen are relative to it).
  const now = Math.max(clock, fulfilledTimeStamp ?? 0);
  const [updateRole] = useUpdateMemberRoleMutation();
  const [remove, removing] = useRemoveMemberMutation();
  const [resendInvite, resending] = useResendInviteMutation();
  const [setAccess, settingAccess] = useSetMemberAccessMutation();
  const [revokeSessions, revoking] = useRevokeMemberSessionsMutation();
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const shown = useLastValue(confirm);
  const online = members.filter((member) => member.online).length;

  const actions: MemberActions = {
    changeRole: async (member, role: StoreRole) => {
      if (role === member.role) return;
      try {
        await updateRole({ storeId, userId: member.id, role }).unwrap();
        toast.success(`${memberName(member)} agora é ${ROLES[role].label.toLowerCase()}`);
      } catch {
        // baseApi shows the reason (e.g. the last manager).
      }
    },
    resendInvite: async (member) => {
      try {
        await resendInvite({ storeId, userId: member.id }).unwrap();
        toast.success(`Convite reenviado para ${member.email}`);
      } catch {
        // baseApi shows the reason.
      }
    },
    enable: async (member) => {
      try {
        await setAccess({ storeId, userId: member.id, enabled: true }).unwrap();
        toast.success(`${memberName(member)} pode acessar a loja de novo`);
      } catch {
        // baseApi shows the reason.
      }
    },
    disable: (member) => setConfirm({ kind: "disable", member }),
    endSessions: (member) => setConfirm({ kind: "sessions", member }),
    remove: (member) => setConfirm({ kind: "remove", member }),
  };

  const runConfirmed = async () => {
    if (!confirm) return;
    const { kind, member } = confirm;
    try {
      if (kind === "remove") {
        await remove({ storeId, userId: member.id }).unwrap();
        toast.success("Removido da equipe");
      } else if (kind === "disable") {
        await setAccess({ storeId, userId: member.id, enabled: false }).unwrap();
        toast.success(`Acesso de ${memberName(member)} desativado`);
      } else {
        const { ended } = await revokeSessions({ storeId, userId: member.id }).unwrap();
        toast.success(
          ended === 0 ? "Nenhuma sessão aberta" : `${ended} ${ended === 1 ? "sessão encerrada" : "sessões encerradas"}`,
        );
      }
    } catch {
      // baseApi shows the reason (e.g. the last manager).
    }
    setConfirm(null);
  };

  const shownName = shown ? memberName(shown.member) : "";
  const dialog = !shown
    ? null
    : shown.kind === "remove"
      ? {
          title: shown.member.id === me ? "Sair da equipe desta loja?" : `Remover ${shownName} da equipe?`,
          description:
            shown.member.id === me
              ? "Você perde o acesso a esta loja na hora."
              : "A pessoa perde o acesso a esta loja na hora. A conta continua existindo.",
          confirmLabel: shown.member.id === me ? "Sair" : "Remover",
          icon: undefined,
        }
      : shown.kind === "disable"
        ? {
            title: `Desativar o acesso de ${shownName}?`,
            description:
              "A pessoa sai do painel desta loja na hora (e, se não trabalhar em outra loja, as sessões abertas dela são encerradas). Ela continua na equipe com a mesma função, e você pode reativar quando quiser.",
            confirmLabel: "Desativar",
            icon: <ShieldOff />,
          }
        : {
            title: `Encerrar as sessões de ${shownName}?`,
            description:
              "Todos os aparelhos conectados saem do painel. O acesso continua: a pessoa pode entrar de novo com a senha e o código.",
            confirmLabel: "Encerrar sessões",
            icon: <LogOut />,
          };

  return (
    <ManagementPageShell
      storeId={storeId}
      pageLabel="Equipe"
      description="Quem acessa o painel desta loja, o que cada pessoa pode fazer e quem está online."
      action={<AddMemberDialog storeId={storeId} />}
    >
      {!isLoading && members.length > 0 && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
          <span aria-hidden className={cn("size-2 rounded-full", online ? "bg-success" : "bg-muted-foreground/40")} />
          {members.length} {members.length === 1 ? "pessoa" : "pessoas"} ·{" "}
          {online === 0 ? "ninguém online agora" : `${online} online agora`}
        </p>
      )}
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
        {members.map((member) => (
          <MemberRow
            key={member.id}
            member={member}
            isMe={member.id === me}
            now={now}
            actions={actions}
            resending={resending.isLoading && resending.originalArgs?.userId === member.id}
          />
        ))}
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
        open={Boolean(confirm)}
        onOpenChange={(open) => !open && setConfirm(null)}
        loading={removing.isLoading || settingAccess.isLoading || revoking.isLoading}
        title={dialog?.title ?? ""}
        description={dialog?.description ?? ""}
        confirmLabel={dialog?.confirmLabel}
        icon={dialog?.icon}
        onConfirm={() => void runConfirmed()}
      />
    </ManagementPageShell>
  );
}
