"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { LogOut, MonitorSmartphone, Monitor, ShieldCheck, Smartphone, Tablet } from "lucide-react";
import type { AccountSession } from "@react-menu/contracts";
import { AlertDialogDestructive } from "@/components/app/alert-dialog-destructive";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { timeAgo } from "@/lib/relative-time";
import {
  useGetSessionsQuery,
  useRevokeOtherSessionsMutation,
  useRevokeSessionMutation,
} from "@/redux/features/account/accountApi";
import { getErrorMessage } from "@/utils/get-error-message";
import { useLastValue } from "@/hooks/use-last-value";

const DEVICE_ICON = { desktop: Monitor, mobile: Smartphone, tablet: Tablet } as const;
const DEVICE_LABEL = { desktop: "Computador", mobile: "Celular", tablet: "Tablet" } as const;
const date = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

const describe = (session: AccountSession) =>
  [session.browser, session.os].filter(Boolean).join(" · ") || DEVICE_LABEL[session.device];

/** Where the account is signed in, with "Este dispositivo" and a way out for the others. */
export function SessionsCard() {
  const { data: sessions, isLoading } = useGetSessionsQuery();
  const [revoke, revoking] = useRevokeSessionMutation();
  const [revokeOthers, revokingOthers] = useRevokeOtherSessionsMutation();
  const [confirm, setConfirm] = useState<AccountSession | "others" | null>(null);
  // The dialog's text stays the same while it animates closed.
  const asked = useLastValue(confirm);
  const others = sessions?.filter((session) => !session.current).length ?? 0;

  const run = async () => {
    if (!confirm) return;
    try {
      if (confirm === "others") {
        await revokeOthers().unwrap();
        toast.success("Você saiu dos outros aparelhos");
      } else {
        await revoke(confirm.id).unwrap();
        toast.success(`Sessão encerrada: ${describe(confirm)}`);
      }
      setConfirm(null);
    } catch (error) {
      toast.error(getErrorMessage(error, "Não foi possível encerrar a sessão."));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MonitorSmartphone className="text-primary" /> Sessões ativas
        </CardTitle>
        <CardDescription>
          Aparelhos com a sua conta aberta. Não reconhece algum? Encerre a sessão e troque a senha.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-16 rounded-xl" />
          </div>
        ) : (
          <ul className="flex flex-col gap-2" aria-label="Sessões">
            <AnimatePresence initial={false}>
              {sessions?.map((session) => {
                const Icon = DEVICE_ICON[session.device];
                return (
                  <motion.li
                    key={session.id}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -12, transition: { duration: 0.18 } }}
                    className="flex items-center gap-3 rounded-xl border p-3 data-current:border-primary/40 data-current:bg-primary/5"
                    data-current={session.current || undefined}
                    aria-label={describe(session)}
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <Icon aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                        <span className="truncate">{describe(session)}</span>
                        {session.current && (
                          <Badge variant="outline" className="border-success/40 text-success">
                            <span className="size-1.5 rounded-full bg-success" aria-hidden /> Este dispositivo
                          </Badge>
                        )}
                        {session.trusted && (
                          <Badge variant="secondary" title="Não pede o código de verificação por 30 dias">
                            <ShieldCheck aria-hidden /> Confiável
                          </Badge>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {session.current ? "Ativa agora" : `Ativa ${timeAgo(session.lastActiveAt)}`}
                        {session.ipAddress && ` · IP ${session.ipAddress}`}
                        {` · Entrou em ${date.format(new Date(session.signedInAt))}`}
                      </p>
                    </div>
                    {!session.current && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setConfirm(session)}
                      >
                        <LogOut data-icon="inline-start" /> Encerrar
                      </Button>
                    )}
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}
      </CardContent>
      {others > 0 && (
        <CardFooter className="justify-end">
          <Button variant="outline" onClick={() => setConfirm("others")}>
            <LogOut data-icon="inline-start" /> Sair dos outros aparelhos ({others})
          </Button>
        </CardFooter>
      )}

      <AlertDialogDestructive
        open={confirm !== null}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={asked === "others" ? "Sair dos outros aparelhos?" : "Encerrar esta sessão?"}
        description={
          asked === "others"
            ? `A sua conta será fechada em ${others} ${others === 1 ? "aparelho" : "aparelhos"}. Este continua conectado.`
            : asked
              ? `${describe(asked)} precisará entrar de novo.`
              : ""
        }
        confirmLabel={asked === "others" ? "Sair dos outros" : "Encerrar sessão"}
        loading={revoking.isLoading || revokingOthers.isLoading}
        onConfirm={() => void run()}
      />
    </Card>
  );
}
