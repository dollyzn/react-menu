"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, ChevronDown, Copy, ShieldCheck, Smartphone } from "lucide-react";
import { CodeInput } from "@/components/app/auth/code-input";
import { Button } from "@/components/ui/button";
import { Confetti, type ConfettiRef } from "@/components/ui/confetti";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FieldError } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { useSession } from "@/contexts/session-provider";
import { useEnableTwoFactorMutation, useSetupTwoFactorMutation } from "@/redux/features/account/accountApi";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/utils/get-error-message";
import { RecoveryCodes } from "./recovery-codes";

type Step = "scan" | "verify" | "codes";
const STEPS: { id: Step; label: string }[] = [
  { id: "scan", label: "Escanear" },
  { id: "verify", label: "Confirmar" },
  { id: "codes", label: "Guardar códigos" },
];
const APPS = ["Google Authenticator", "Microsoft Authenticator", "1Password", "Authy"];
const PERIOD = 30;

/** "ABCD EFGH IJKL…" (easier to type into an app by hand). */
const grouped = (secret: string) => secret.match(/.{1,4}/g)?.join(" ") ?? secret;

/** Seconds left of the current 30-second code, ticking. */
function usePeriodLeft(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [active]);
  return PERIOD - (Math.floor(now / 1000) % PERIOD);
}

/** Numbered steps joined by a line that fills as they're done. */
function Stepper({ current }: { current: number }) {
  return (
    <ol className="mt-4 flex items-start" aria-label="Etapas">
      {STEPS.map((step, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li key={step.id} aria-current={active ? "step" : undefined} className="relative flex flex-1 flex-col items-center gap-1.5">
            {index > 0 && (
              <span className="absolute top-3.5 right-1/2 left-[-50%] h-0.5 -translate-y-1/2 overflow-hidden rounded-full bg-muted" aria-hidden>
                <motion.span
                  className="block h-full bg-primary"
                  initial={false}
                  animate={{ width: index <= current ? "100%" : "0%" }}
                  transition={{ duration: 0.35, ease: "easeOut" }}
                />
              </span>
            )}
            <motion.span
              initial={false}
              animate={{ scale: active ? 1.08 : 1 }}
              className={cn(
                "relative z-10 flex size-7 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors",
                done && "border-primary bg-primary text-primary-foreground",
                active && "border-primary bg-background text-primary ring-4 ring-primary/15",
                !done && !active && "border-muted bg-background text-muted-foreground"
              )}
            >
              {done ? <Check className="size-3.5" aria-hidden /> : index + 1}
            </motion.span>
            <span className={cn("text-xs font-medium", active || done ? "text-foreground" : "text-muted-foreground")}>
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * The QR on white with viewfinder corners around it that breathe gently.
 * Nothing moves over the code itself: it must stay easy for a camera to read.
 */
function QrFrame({ uri }: { uri: string | null }) {
  const reduceMotion = useReducedMotion();
  const corners = [
    "top-0 left-0 border-t-[3px] border-l-[3px] rounded-tl-xl",
    "top-0 right-0 border-t-[3px] border-r-[3px] rounded-tr-xl",
    "bottom-0 left-0 border-b-[3px] border-l-[3px] rounded-bl-xl",
    "bottom-0 right-0 border-b-[3px] border-r-[3px] rounded-br-xl",
  ];
  return (
    <div className="relative mx-auto w-fit p-2.5">
      <motion.span
        aria-hidden
        className="absolute inset-0"
        animate={reduceMotion || !uri ? undefined : { scale: [1, 1.04, 1], opacity: [1, 0.7, 1] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      >
        {corners.map((corner) => (
          <span key={corner} className={cn("absolute size-6 border-primary", corner)} />
        ))}
      </motion.span>
      <div className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-black/5">
        {uri ? (
          <QRCodeSVG value={uri} size={168} marginSize={0} title="QR code do app autenticador" />
        ) : (
          <Skeleton className="size-[168px] rounded-lg" />
        )}
      </div>
    </div>
  );
}

/** Seconds left of the app's current code, as a small ring. */
function PeriodRing({ left }: { left: number }) {
  const radius = 9;
  const circumference = 2 * Math.PI * radius;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
      <svg viewBox="0 0 24 24" className="size-5 -rotate-90" aria-hidden>
        <circle cx="12" cy="12" r={radius} className="fill-none stroke-muted" strokeWidth="3" />
        <circle
          cx="12"
          cy="12"
          r={radius}
          className={cn("fill-none transition-[stroke-dashoffset] duration-1000 ease-linear", left <= 5 ? "stroke-warning" : "stroke-primary")}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - left / PERIOD)}
        />
      </svg>
      Novo código em {left}s
    </span>
  );
}

/**
 * Turns on the authenticator app: scan, confirm with a code, keep the
 * recovery codes. Keep it mounted while open: enabling flips the card to
 * "Ativo" behind it, and the codes are shown only here.
 */
export function TwoFactorSetupDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { verify } = useSession();
  const reduceMotion = useReducedMotion();
  const confetti = useRef<ConfettiRef>(null);
  const [step, setStep] = useState<Step>("scan");
  const [code, setCode] = useState("");
  const [shake, setShake] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [codes, setCodes] = useState<string[]>([]);
  const [setup, setupResult] = useSetupTwoFactorMutation();
  const [enable, enabling] = useEnableTwoFactorMutation();
  const secret = setupResult.data;
  const periodLeft = usePeriodLeft(open && step === "verify");
  const index = STEPS.findIndex((item) => item.id === step);

  // A new secret each time it opens. (Run twice in development's strict mode,
  // the last secret is the one shown and the one the API waits for.)
  useEffect(() => {
    if (open) void setup();
  }, [open, setup]);

  const changeOpen = (next: boolean) => {
    // The recovery codes show once: closing means "done".
    if (!next && step === "codes") void verify();
    onOpenChange(next);
  };

  const confirm = async (value: string) => {
    setError(null);
    try {
      const { recoveryCodes } = await enable({ code: value }).unwrap();
      setCodes(recoveryCodes);
      setStep("codes");
      if (!reduceMotion) void confetti.current?.fire({ particleCount: 120, spread: 75, origin: { y: 0.35 } });
    } catch (err) {
      setError(getErrorMessage(err, "Código inválido."));
      setCode("");
      setShake((n) => n + 1);
    }
  };

  const copySecret = async () => {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret.secret);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  const slide = {
    initial: { opacity: 0, x: reduceMotion ? 0 : 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: reduceMotion ? 0 : -20 },
    transition: { duration: 0.2 },
  };

  return (
    <Dialog
      open={open}
      onOpenChange={changeOpen}
      // Fresh once closed (not while it fades out).
      onOpenChangeComplete={(next) => {
        if (next) return;
        setStep("scan");
        setCode("");
        setError(null);
        setShowKey(false);
        setCopied(false);
        setCodes([]);
        setupResult.reset();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <Confetti ref={confetti} manualstart className="pointer-events-none fixed inset-0 z-[60] size-full" />
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-primary to-primary/70 text-primary-foreground shadow-sm shadow-primary/30">
              {step === "codes" ? <ShieldCheck aria-hidden /> : <Smartphone aria-hidden />}
            </span>
            <div className="flex min-w-0 flex-col gap-0.5">
              <DialogTitle>App autenticador</DialogTitle>
              <DialogDescription>Um código novo a cada 30 segundos, mesmo sem internet no celular.</DialogDescription>
            </div>
          </div>
          <Stepper current={index} />
        </DialogHeader>
        <DialogBody>
          {/* The steps slide sideways: clip them here (no horizontal scroll, and
              never overflow on DialogContent). */}
          <div className="-mx-3 overflow-x-clip px-3">
          <AnimatePresence mode="wait" initial={false}>
            {step === "scan" && (
              <motion.div key="scan" {...slide} className="flex flex-col gap-5">
                <div className="grid items-center gap-5 sm:grid-cols-[auto_1fr]">
                  <QrFrame uri={secret?.uri ?? null} />
                  <ol className="flex flex-col gap-3 text-sm">
                    {[
                      "Abra o app autenticador no celular.",
                      <>Toque em <strong>+</strong> para adicionar uma conta.</>,
                      "Aponte a câmera para este QR code.",
                    ].map((text, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                          {i + 1}
                        </span>
                        <span className="text-muted-foreground [&_strong]:text-foreground">{text}</span>
                      </li>
                    ))}
                  </ol>
                </div>

                <div className="flex flex-wrap justify-center gap-1.5" aria-label="Apps compatíveis">
                  {APPS.map((app) => (
                    <span key={app} className="rounded-full border bg-muted/40 px-2.5 py-0.5 text-xs text-muted-foreground">
                      {app}
                    </span>
                  ))}
                </div>

                <div className="rounded-xl border">
                  <button
                    type="button"
                    onClick={() => setShowKey((value) => !value)}
                    aria-expanded={showKey}
                    className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-sm outline-none hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    Não consegue escanear? Digite a chave
                    <ChevronDown aria-hidden className={cn("size-4 text-muted-foreground transition-transform", showKey && "rotate-180")} />
                  </button>
                  <AnimatePresence initial={false}>
                    {showKey && secret && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="flex items-center gap-2 border-t px-3 py-2.5">
                          <code className="min-w-0 flex-1 font-mono text-sm tracking-wide break-all" aria-label="Chave do app autenticador">
                            {grouped(secret.secret)}
                          </code>
                          <Button type="button" size="sm" variant="secondary" onClick={() => void copySecret()}>
                            {copied ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
                            {copied ? "Copiada" : "Copiar"}
                          </Button>
                        </div>
                        <p className="px-3 pb-2.5 text-xs text-muted-foreground">Tipo: baseada em tempo (TOTP), 6 dígitos.</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {setupResult.isError && (
                  <FieldError errors={[{ message: getErrorMessage(setupResult.error, "Não foi possível começar.") }]} />
                )}
                <Button type="button" size="lg" onClick={() => setStep("verify")} disabled={!secret}>
                  Já adicionei no app <ArrowRight data-icon="inline-end" />
                </Button>
              </motion.div>
            )}

            {step === "verify" && (
              <motion.div key="verify" {...slide} className="flex flex-col items-center gap-5 py-2 text-center">
                <div className="flex flex-col gap-1">
                  <p className="font-medium">Digite o código que o app mostra agora</p>
                  <PeriodRing left={periodLeft} />
                </div>
                <CodeInput
                  value={code}
                  onChange={(value) => {
                    setCode(value);
                    setError(null);
                  }}
                  onComplete={(value) => void confirm(value)}
                  state={error ? "error" : "idle"}
                  shake={shake}
                  disabled={enabling.isLoading}
                  autoFocus
                />
                <div className="flex min-h-5 items-center justify-center text-sm" aria-live="polite">
                  {enabling.isLoading ? (
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Spinner aria-hidden /> Verificando…
                    </span>
                  ) : error ? (
                    <FieldError errors={[{ message: `${error} Use o código atual do app.` }]} />
                  ) : null}
                </div>
                <Button type="button" variant="ghost" onClick={() => setStep("scan")} disabled={enabling.isLoading}>
                  <ArrowLeft data-icon="inline-start" /> Voltar ao QR code
                </Button>
              </motion.div>
            )}

            {step === "codes" && (
              <motion.div key="codes" {...slide} className="flex flex-col gap-4">
                <div className="flex items-center gap-3 rounded-xl border border-success/30 bg-success/10 p-3">
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 420, damping: 16, delay: 0.1 }}
                    className="flex size-9 shrink-0 items-center justify-center rounded-full bg-success text-white"
                  >
                    <Check aria-hidden />
                  </motion.span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">App autenticador ativado!</p>
                    <p className="text-xs text-muted-foreground">Nos próximos logins, use o código do app.</p>
                  </div>
                </div>
                <RecoveryCodes codes={codes} onDone={() => changeOpen(false)} />
              </motion.div>
            )}
          </AnimatePresence>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
