"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, KeyRound, MailCheck, ShieldCheck, Smartphone } from "lucide-react";
import type { TwoFactorChallenge } from "@react-menu/contracts";
import { CodeInput } from "@/components/app/auth/code-input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useSession } from "@/contexts/session-provider";
import { useResendTwoFactorMutation } from "@/redux/features/auth/authApi";
import { getErrorMessage } from "@/utils/get-error-message";

/** Seconds until `iso` (0 once it passed), ticking every second. */
function useSecondsUntil(iso: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!iso) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [iso]);
  return iso ? Math.max(0, Math.ceil((new Date(iso).getTime() - now) / 1000)) : 0;
}

/**
 * The second step of a sign-in: the code sent by e-mail or the authenticator
 * app's (or a recovery code). Six digits submit by themselves.
 */
export function TwoFactorStep({ challenge: initial, onBack }: { challenge: TwoFactorChallenge; onBack: () => void }) {
  const router = useRouter();
  const { completeTwoFactor } = useSession();
  const [resend, resending] = useResendTwoFactorMutation();
  const [challenge, setChallenge] = useState(initial);
  const [code, setCode] = useState("");
  const [recovery, setRecovery] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState("");
  const [remember, setRemember] = useState(false);
  const [state, setState] = useState<"idle" | "busy" | "error" | "success">("idle");
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [shake, setShake] = useState(0);
  const resendIn = useSecondsUntil(challenge.resendAt);
  const email = challenge.method === "email";

  const submit = async (value: string, asRecovery = false) => {
    if (state === "busy" || state === "success") return;
    setState("busy");
    setError(null);
    const result = await completeTwoFactor({ code: value, recovery: asRecovery, remember });
    if (!result.error) {
      setState("success");
      router.push("/app/stores");
      return;
    }
    setState("error");
    setError(result.error);
    setExpired(Boolean(result.expired) || result.attemptsLeft === 0);
    setShake((n) => n + 1);
    if (!asRecovery) setCode("");
  };

  const askAgain = async () => {
    try {
      const { twoFactor } = await resend().unwrap();
      setChallenge(twoFactor);
      setCode("");
      setError(null);
      setState("idle");
    } catch (err) {
      setError(getErrorMessage(err, "Não foi possível reenviar o código."));
    }
  };

  const Icon = recovery ? KeyRound : email ? MailCheck : Smartphone;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <motion.span
          key={state === "success" ? "ok" : recovery ? "recovery" : challenge.method}
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 20 }}
          className={
            state === "success"
              ? "flex size-12 items-center justify-center rounded-full bg-success/10 text-success"
              : "flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary"
          }
        >
          {state === "success" ? <ShieldCheck aria-hidden /> : <Icon aria-hidden />}
        </motion.span>
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">{state === "success" ? "Tudo certo!" : "Confirme que é você"}</h2>
          <p className="text-sm text-balance text-muted-foreground" aria-live="polite">
            {state === "success"
              ? "Abrindo o painel…"
              : recovery
                ? "Digite um dos códigos de recuperação que você guardou ao ativar o app autenticador."
                : email
                  ? <>Enviamos um código de 6 dígitos para <strong className="text-foreground">{challenge.emailHint}</strong>.</>
                  : "Digite o código de 6 dígitos do seu app autenticador."}
          </p>
        </div>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {recovery ? (
          <motion.form
            key="recovery"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            onSubmit={(event) => {
              event.preventDefault();
              void submit(recoveryCode, true);
            }}
            className="flex flex-col gap-3"
          >
            <Field data-invalid={state === "error" || undefined}>
              <FieldLabel htmlFor="recovery-code">Código de recuperação</FieldLabel>
              <Input
                id="recovery-code"
                value={recoveryCode}
                onChange={(event) => setRecoveryCode(event.target.value.toUpperCase())}
                placeholder="ABCD-EF23"
                autoComplete="off"
                autoCapitalize="characters"
                autoFocus
                className="text-center font-mono text-lg tracking-widest"
                aria-invalid={state === "error" || undefined}
              />
            </Field>
            <Button type="submit" size="lg" loading={state === "busy"} disabled={recoveryCode.replace(/[^A-Z0-9]/gi, "").length < 8}>
              Entrar
            </Button>
          </motion.form>
        ) : (
          <motion.div key="code" initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }}>
            <CodeInput
              value={code}
              onChange={(value) => {
                setCode(value);
                if (state === "error") setState("idle");
              }}
              onComplete={(value) => void submit(value)}
              state={state === "error" ? "error" : state === "success" ? "success" : "idle"}
              shake={shake}
              disabled={state === "busy" || state === "success" || expired}
              autoFocus
            />
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <FieldError className="text-center" errors={[{ message: error }]} />
      )}

      <label className="flex items-center justify-center gap-2 text-sm">
        <Checkbox checked={remember} onCheckedChange={(checked) => setRemember(Boolean(checked))} disabled={state === "success"} />
        Confiar neste dispositivo por 30 dias
      </label>

      <div className="flex flex-col items-center gap-1 text-sm">
        {expired ? (
          <Button type="button" variant="outline" onClick={onBack}>
            Entrar de novo
          </Button>
        ) : (
          <>
            {email && (
              <Button
                type="button"
                variant="link"
                size="sm"
                disabled={resendIn > 0 || resending.isLoading}
                onClick={() => void askAgain()}
              >
                {resendIn > 0 ? `Reenviar código em ${resendIn}s` : "Não chegou? Reenviar código"}
              </Button>
            )}
            {!email && (
              <Button type="button" variant="link" size="sm" onClick={() => { setRecovery((value) => !value); setError(null); setState("idle"); }}>
                {recovery ? "Usar o app autenticador" : "Perdeu o celular? Usar um código de recuperação"}
              </Button>
            )}
          </>
        )}
        <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={onBack} disabled={state === "success"}>
          <ArrowLeft data-icon="inline-start" /> Voltar para o login
        </Button>
      </div>
    </div>
  );
}
