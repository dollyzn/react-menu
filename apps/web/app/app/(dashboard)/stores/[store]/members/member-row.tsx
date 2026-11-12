"use client";

import { LogOut, MailPlus, MoreHorizontal, ShieldCheck, ShieldOff, UserMinus } from "lucide-react";
import type { StoreMember, StoreRole } from "@react-menu/contracts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { timeAgo } from "@/lib/relative-time";
import { cn } from "@/lib/utils";
import { ROLE_ITEMS, ROLES } from "./roles";
import { UserAvatar } from "@/components/app/photo-avatar";

export const memberName = (member: StoreMember) => member.name ?? member.email;

/** What the page does for a row (the dialogs live in the page). */
export interface MemberActions {
  changeRole: (member: StoreMember, role: StoreRole) => void;
  resendInvite: (member: StoreMember) => void;
  enable: (member: StoreMember) => void;
  disable: (member: StoreMember) => void;
  endSessions: (member: StoreMember) => void;
  remove: (member: StoreMember) => void;
}

/** "Online agora", "Visto há 3 horas", the invite's deadline… */
function Presence({ member, now }: { member: StoreMember; now: number }) {
  if (member.disabledAt) return <>Acesso desativado {timeAgo(member.disabledAt, now)}</>;
  if (member.online) return <span className="font-medium text-success">Online agora</span>;
  if (member.invitePending) {
    if (!member.inviteExpiresAt) return <>Ainda não aceitou o convite</>;
    return new Date(member.inviteExpiresAt).getTime() < now ? (
      <span className="text-destructive">O convite expirou {timeAgo(member.inviteExpiresAt, now)}</span>
    ) : (
      <>O convite expira {timeAgo(member.inviteExpiresAt, now)}</>
    );
  }
  if (member.lastSeenAt) return <>Visto {timeAgo(member.lastSeenAt, now)}</>;
  return <>Sem atividade recente</>;
}

export function MemberRow({
  member,
  isMe,
  now,
  actions,
  resending,
}: {
  member: StoreMember;
  isMe: boolean;
  /** The page's clock (ticks every minute, so "visto há" stays current). */
  now: number;
  actions: MemberActions;
  resending: boolean;
}) {
  const name = memberName(member);
  const Icon = ROLES[member.role].icon;
  const disabled = Boolean(member.disabledAt);
  const inviteExpired =
    member.invitePending && member.inviteExpiresAt && new Date(member.inviteExpiresAt).getTime() < now;
  // Super users always have access; nobody switches themselves off.
  const canManageAccess = !isMe && !member.superUser;

  return (
    <li className="flex flex-wrap items-center gap-3 p-4" aria-label={name}>
      <span className={cn("relative shrink-0", disabled && "opacity-50 grayscale")}>
        <UserAvatar user={member} className="size-10 border" />
        {member.online && (
          <span aria-hidden className="absolute right-0 bottom-0 size-3 rounded-full bg-success ring-2 ring-card" />
        )}
      </span>
      <div className={cn("min-w-0 flex-1", disabled && "text-muted-foreground")}>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium">
          <span className="truncate">{name}</span>
          {isMe && <Badge variant="secondary">Você</Badge>}
          {member.superUser && <Badge variant="outline">Admin da plataforma</Badge>}
          {disabled && <Badge variant="destructive">Acesso desativado</Badge>}
          {member.invitePending &&
            (inviteExpired ? (
              <Badge variant="destructive">Convite expirado</Badge>
            ) : (
              <Badge variant="outline">Convite pendente</Badge>
            ))}
          {!member.invitePending && !member.emailVerified && (
            <Badge variant="outline" className="text-warning">
              E-mail não verificado
            </Badge>
          )}
        </p>
        <p className="truncate text-sm text-muted-foreground">{member.email}</p>
        <p className="text-xs text-muted-foreground">
          <Presence member={member} now={now} />
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Select
          items={ROLE_ITEMS}
          value={member.role}
          onValueChange={(value) => actions.changeRole(member, value as StoreRole)}
        >
          <SelectTrigger className="w-40" aria-label={`Função de ${name}`}>
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
        {member.invitePending && !disabled && (
          <Button variant="outline" size="sm" loading={resending} onClick={() => actions.resendInvite(member)}>
            {!resending && <MailPlus />} Reenviar convite
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Ações de ${name}`} />}>
            <MoreHorizontal />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-52">
            {canManageAccess &&
              (disabled ? (
                <DropdownMenuItem onClick={() => actions.enable(member)}>
                  <ShieldCheck /> Reativar acesso
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => actions.disable(member)}>
                  <ShieldOff /> Desativar acesso
                </DropdownMenuItem>
              ))}
            {canManageAccess && !disabled && !member.invitePending && (
              <DropdownMenuItem onClick={() => actions.endSessions(member)}>
                <LogOut /> Encerrar sessões
              </DropdownMenuItem>
            )}
            {canManageAccess && <DropdownMenuSeparator />}
            <DropdownMenuItem variant="destructive" onClick={() => actions.remove(member)}>
              <UserMinus /> {isMe ? "Sair da equipe" : "Remover da equipe"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}
