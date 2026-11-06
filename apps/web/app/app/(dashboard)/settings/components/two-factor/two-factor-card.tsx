"use client";

import { useState } from "react";
import { toast } from "sonner";
import { KeyRound, Mail, ShieldCheck, Smartphone } from "lucide-react";
import { CodeInput } from "@/components/app/auth/code-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/contexts/session-provider";
import {
  useDisableTwoFactorMutation,
  useRegenerateRecoveryCodesMutation,
  useTwoFactorStatusQuery,
} from "@/redux/features/account/accountApi";
import { getErrorMessage } from "@/utils/get-error-message";
import { RecoveryCodes } from "./recovery-codes";
import { TwoFactorSetupDialog } from "./setup-dialog";

const date = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

/** Masks like the API: "a•••@gmail.com". */
const maskEmail = (email: string) => `${email.slice(0, 1)}•••@${email.split("@")[1] ?? ""}`;

/**
 * Two-step sign-in: by default a code by e-mail on every sign-in; the
 * authenticator app replaces it (with recovery codes for a lost phone).
 */
export function TwoFactorCard() {
  const { user } = useSession();
  const { data: status, isLoading } = useTwoFactorStatusQuery();
  const [disableOpen, setDisableOpen] = useState(false);
  const [codesOpen, setCodesOpen] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const enabled = status?.enabled ?? false;

  return (
    <Card id="verificacao-em-duas-etapas" className="scroll-mt-20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="text-primary" /> Verificação em duas etapas
        </CardTitle>
        <CardDescription>Além da senha (ou do Google), todo login pede um código.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {isLoading || !user ? (
          <>
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-16 rounded-xl" />
          </>
        ) : (
          <>
            <div className="flex items-center gap-3 rounded-xl border p-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Mail aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">Código por e-mail</p>
                <p className="text-xs text-muted-foreground">
                  {enabled ? "Substituído pelo app autenticador." : `Enviado para ${maskEmail(user.email)} a cada login.`}
                </p>
              </div>
              {!enabled && (
                <Badge variant="outline" className="border-success/40 text-success">
                  Em uso
                </Badge>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 rounded-xl border p-3 data-on:border-primary/40 data-on:bg-primary/5" data-on={enabled || undefined}>
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Smartphone aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  App autenticador
                  {enabled ? (
                    <Badge variant="outline" className="border-success/40 text-success">
                      <span className="size-1.5 rounded-full bg-success" aria-hidden /> Ativo
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Recomendado</Badge>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {enabled
                    ? `Desde ${status?.enabledAt ? date.format(new Date(status.enabledAt)) : "hoje"} · ${status?.recoveryCodesLeft ?? 0} ${status?.recoveryCodesLeft === 1 ? "código de recuperação restante" : "códigos de recuperação restantes"}`
                    : "Entre sem esperar e-mail, mesmo sem internet no celular."}
                </p>
              </div>
              {enabled ? (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setCodesOpen(true)}>
                    <KeyRound data-icon="inline-start" /> Novos códigos
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDisableOpen(true)}>
                    Desativar
                  </Button>
                </div>
              ) : (
                <Button size="sm" onClick={() => setSetupOpen(true)}>
                  <Smartphone data-icon="inline-start" /> Configurar
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
      <TwoFactorSetupDialog open={setupOpen} onOpenChange={setSetupOpen} />
      <DisableDialog open={disableOpen} onOpenChange={setDisableOpen} />
      <NewCodesDialog open={codesOpen} onOpenChange={setCodesOpen} />
    </Card>
  );
}

/** Back to e-mail codes; needs the password. */
function DisableDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { verify } = useSession();
  const [disable, disabling] = useDisableTwoFactorMutation();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await disable({ password }).unwrap();
      await verify();
      toast.success("App autenticador desativado", { description: "Os logins voltam a pedir o código por e-mail." });
      onOpenChange(false);
    } catch (err) {
      setError(getErrorMessage(err, "Não foi possível desativar."));
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !disabling.isLoading && onOpenChange(next)}
      onOpenChangeComplete={(next) => {
        if (next) return;
        setPassword("");
        setError(null);
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Desativar o app autenticador?</DialogTitle>
            <DialogDescription>
              Os logins voltam a pedir um código por e-mail, os códigos de recuperação deixam de valer e os aparelhos
              confiáveis pedem o código de novo.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <Field data-invalid={Boolean(error) || undefined}>
              <FieldLabel htmlFor="disable-2fa-password">Sua senha</FieldLabel>
              <Input
                id="disable-2fa-password"
                type="password"
                autoComplete="current-password"
                placeholder="Digite a sua senha"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                aria-invalid={Boolean(error) || undefined}
              />
              {error && <FieldError errors={[{ message: error }]} />}
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={disabling.isLoading}>
              Cancelar
            </Button>
            <Button type="submit" variant="destructive" loading={disabling.isLoading} disabled={!password}>
              Desativar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** New recovery codes (the old ones stop working); needs a code from the app. */
function NewCodesDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [regenerate, regenerating] = useRegenerateRecoveryCodesMutation();
  const [code, setCode] = useState("");
  const [codes, setCodes] = useState<string[] | null>(null);
  const [kept, setKept] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(0);

  // The new codes show only here: closing waits for "Guardei".
  const changeOpen = (next: boolean) => {
    if (!next && codes && !kept) {
      toast.warning("Guarde os códigos de recuperação antes de fechar.");
      return;
    }
    onOpenChange(next);
  };

  const submit = async (value: string) => {
    try {
      const { recoveryCodes } = await regenerate({ code: value }).unwrap();
      setCodes(recoveryCodes);
    } catch (err) {
      setError(getErrorMessage(err, "Código inválido."));
      setCode("");
      setShake((n) => n + 1);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={changeOpen}
      onOpenChangeComplete={(next) => {
        if (next) return;
        setCode("");
        setCodes(null);
        setKept(false);
        setError(null);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novos códigos de recuperação</DialogTitle>
          <DialogDescription>
            {codes ? "Os códigos antigos não valem mais." : "Confirme com o código do app. Os códigos antigos deixam de valer."}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          {codes ? (
            <RecoveryCodes codes={codes} kept={kept} onKeptChange={setKept} onDone={() => changeOpen(false)} />
          ) : (
            <div className="flex flex-col gap-3 pb-2">
              <CodeInput
                value={code}
                onChange={(value) => {
                  setCode(value);
                  setError(null);
                }}
                onComplete={(value) => void submit(value)}
                state={error ? "error" : "idle"}
                shake={shake}
                disabled={regenerating.isLoading}
                autoFocus
              />
              {error && <FieldError className="text-center" errors={[{ message: error }]} />}
            </div>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
