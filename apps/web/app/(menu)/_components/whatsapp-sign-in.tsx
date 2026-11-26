"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, BadgeCheck, LogOut } from "lucide-react";
import type { CustomerLoginChallenge, PublicMenu } from "@react-menu/contracts";
import { CodeInput } from "@/components/app/auth/code-input";
import { Icons } from "@/components/app/icons";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { linkStore, unlinkStore } from "@/redux/slices/customer";
import {
  useClaimCustomerLoginMutation,
  usePollCustomerLoginMutation,
  useSignOutCustomerMutation,
  useStartCustomerLoginMutation,
} from "@/redux/features/public/publicApi";
import { formatPhoneBR } from "@/utils/string";
import { errorCode, getErrorMessage } from "@/utils/get-error-message";

type Store = Pick<PublicMenu["store"], "name" | "slug" | "whatsapp">;

/** How often the page asks whether the customer's message arrived. */
const POLL_MS = 2500;

/** WhatsApp's green with dark text (white on it reads at ~2:1). */
const WHATSAPP_BUTTON = "rounded-full bg-whatsapp text-whatsapp-foreground hover:bg-whatsapp-hover";

/** The card around every state: WhatsApp's mark, a title and what it is about. */
function Panel({
  id,
  title,
  description,
  className,
  children,
}: {
  id: string;
  title: string;
  description: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("rounded-2xl border bg-card p-4 shadow-xs sm:p-5", className)} aria-labelledby={id}>
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-whatsapp/15 text-whatsapp">
          <Icons.whatsapp className="size-5" />
        </span>
        <div className="min-w-0">
          <h2 id={id} className="font-semibold">
            {title}
          </h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-3">{children}</div>
    </section>
  );
}

/**
 * "Veja todos os seus pedidos" in one store (ADR 0025): the customer proves
 * the phone by sending a code from their WhatsApp (free for the store), or
 * by typing a code the store sends. The session it opens is kept per store
 * on this device; the list of orders above fills in as the confirmation.
 */
export function WhatsAppSignIn({
  store,
  signedIn,
  className,
}: {
  store: Store;
  signedIn?: { name: string | null; phone: string };
  className?: string;
}) {
  const dispatch = useAppDispatch();
  const token = useAppSelector((state) => state.customer.tokens?.[store.slug]);
  const [signOut] = useSignOutCustomerMutation();
  const id = `whatsapp-${store.slug}`;

  if (token) {
    return (
      <Panel
        id={id}
        className={className}
        title="Conectado pelo WhatsApp"
        description={<>Todos os seus pedidos na {store.name} aparecem aqui, em qualquer celular.</>}
      >
        <div className="flex items-center gap-3 rounded-xl bg-muted/50 p-3">
          <BadgeCheck className="size-5 shrink-0 text-success" />
          <div className="min-w-0 flex-1 text-sm">
            <p className="truncate font-medium">{signedIn?.name ?? "Seu número"}</p>
            {signedIn && <p className="text-muted-foreground tabular-nums">{signedIn.phone}</p>}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 rounded-full text-muted-foreground"
            onClick={() => {
              void signOut({ slug: store.slug, token });
              dispatch(unlinkStore(store.slug));
            }}
          >
            <LogOut /> Sair
          </Button>
        </div>
      </Panel>
    );
  }

  if (!store.whatsapp.login) return null;
  return <SignInFlow id={id} className={className} store={store} codeAvailable={store.whatsapp.login.code} />;
}

type Step =
  | { kind: "idle" }
  | { kind: "message"; challenge: Extract<CustomerLoginChallenge, { method: "message" }>; opened: boolean }
  | { kind: "phone" }
  | { kind: "code"; challenge: Extract<CustomerLoginChallenge, { method: "code" }> };

function SignInFlow({
  id,
  className,
  store,
  codeAvailable,
}: {
  id: string;
  className?: string;
  store: Store;
  codeAvailable: boolean;
}) {
  const dispatch = useAppDispatch();
  const rememberedPhone = useAppSelector((state) => state.customer.phone);
  const [start, { isLoading: starting }] = useStartCustomerLoginMutation();
  const [claim, { isLoading: claiming }] = useClaimCustomerLoginMutation();
  const [step, setStep] = useState<Step>({ kind: "idle" });
  const [error, setError] = useState<string | null>(null);
  const [phone, setPhone] = useState(() => formatPhoneBR(rememberedPhone));
  const [code, setCode] = useState("");
  const [shake, setShake] = useState(0);

  const signedIn = useCallback(
    (customerToken: string) => {
      dispatch(linkStore({ storeSlug: store.slug, token: customerToken }));
    },
    [dispatch, store.slug]
  );

  const expired = useCallback(() => {
    setStep({ kind: "idle" });
    setCode("");
    setError("O tempo para entrar acabou. Comece de novo.");
  }, []);

  const goTo = (next: Step) => {
    setError(null);
    setStep(next);
  };

  /**
   * One tap: the tab for WhatsApp opens right in the tap (after the request
   * the browser would block it) and goes to the wa.me link once the code
   * exists. Blocked anyway, the step's "Abrir o WhatsApp" is still there.
   */
  const byMessage = async () => {
    setError(null);
    const tab = window.open("", "_blank");
    try {
      const challenge = await start({ slug: store.slug, input: { method: "message" } }).unwrap();
      if (challenge.method !== "message") return tab?.close();
      if (tab && !tab.closed) {
        tab.opener = null;
        tab.location.href = challenge.link;
      }
      setStep({ kind: "message", challenge, opened: Boolean(tab) });
    } catch (err) {
      tab?.close();
      setError(getErrorMessage(err, "Não foi possível começar agora. Tente de novo."));
    }
  };

  const sendCode = async () => {
    setError(null);
    if (phone.replace(/\D/g, "").length < 10) {
      setError("Informe o celular com DDD.");
      return;
    }
    try {
      const challenge = await start({ slug: store.slug, input: { method: "code", phone } }).unwrap();
      if (challenge.method === "code") {
        setCode("");
        setStep({ kind: "code", challenge });
      }
    } catch (err) {
      setError(getErrorMessage(err, "Não foi possível enviar o código."));
    }
  };

  const checkCode = async (value: string) => {
    if (step.kind !== "code") return;
    setError(null);
    try {
      const result = await claim({
        slug: store.slug,
        id: step.challenge.id,
        secret: step.challenge.secret,
        code: value,
      }).unwrap();
      if (result.status === "verified") signedIn(result.customerToken);
    } catch (err) {
      if (errorCode(err) === "E_LOGIN_EXPIRED") return expired();
      setCode("");
      setShake((value) => value + 1);
      setError(getErrorMessage(err, "Código incorreto."));
    }
  };

  const errorLine = error && <FieldError>{error}</FieldError>;

  if (step.kind === "message") {
    return (
      <Panel id={id} className={className} title="Envie a mensagem no WhatsApp" description="É assim que confirmamos que o número é seu.">
        <MessageStep
          store={store}
          challenge={step.challenge}
          opened={step.opened}
          onVerified={signedIn}
          onExpired={expired}
          onCancel={() => goTo({ kind: "idle" })}
        />
      </Panel>
    );
  }

  if (step.kind === "phone" || step.kind === "code") {
    return (
      <Panel
        id={id}
        className={className}
        title="Receber um código"
        description={
          step.kind === "code"
            ? `Mandamos um código pelo WhatsApp para ${step.challenge.phone}.`
            : "A loja manda um código de 6 dígitos para o seu WhatsApp."
        }
      >
        {step.kind === "phone" ? (
          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void sendCode();
            }}
          >
            <Field data-invalid={Boolean(error)}>
              <FieldLabel htmlFor={`${id}-phone`}>Seu celular (WhatsApp)</FieldLabel>
              <Input
                id={`${id}-phone`}
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                placeholder="(11) 98765-4321"
                value={phone}
                aria-invalid={Boolean(error)}
                onChange={(event) => setPhone(formatPhoneBR(event.target.value))}
              />
              {errorLine}
            </Field>
            <Button type="submit" size="lg" className="h-11 w-full rounded-full" loading={starting}>
              Enviar código
            </Button>
          </form>
        ) : (
          <>
            <CodeInput
              value={code}
              onChange={setCode}
              onComplete={(value) => void checkCode(value)}
              state={error ? "error" : "idle"}
              shake={shake}
              disabled={claiming}
              autoFocus
            />
            {error && <p className="text-center text-sm text-destructive">{error}</p>}
          </>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="self-center rounded-full text-muted-foreground"
          onClick={() => goTo(step.kind === "code" ? { kind: "phone" } : { kind: "idle" })}
        >
          <ArrowLeft /> {step.kind === "code" ? "Trocar o número ou pedir outro" : "Voltar"}
        </Button>
      </Panel>
    );
  }

  return (
    <Panel
      id={id}
      className={className}
      title="Veja todos os seus pedidos"
      description={<>Na {store.name}, em qualquer celular, inclusive os feitos no balcão.</>}
    >
      <Button size="lg" className={cn("h-11 w-full", WHATSAPP_BUTTON)} loading={starting} onClick={() => void byMessage()}>
        <Icons.whatsapp /> Continuar com WhatsApp
      </Button>
      {errorLine}
      <p className="text-center text-xs text-muted-foreground">
        Você manda uma mensagem pronta para a loja. Sem senha e sem cadastro.
      </p>
      {codeAvailable && (
        <Button variant="link" size="sm" className="self-center" onClick={() => goTo({ kind: "phone" })}>
          Prefiro receber um código
        </Button>
      )}
    </Panel>
  );
}

/**
 * The code to send and the link that writes it in WhatsApp; the page asks
 * every few seconds (and as soon as it is visible again, coming back from
 * WhatsApp) whether it arrived.
 */
function MessageStep({
  store,
  challenge,
  opened,
  onVerified,
  onExpired,
  onCancel,
}: {
  store: Store;
  challenge: Extract<CustomerLoginChallenge, { method: "message" }>;
  /** The WhatsApp tab was opened by the first tap. */
  opened: boolean;
  onVerified: (token: string) => void;
  onExpired: () => void;
  onCancel: () => void;
}) {
  const [poll] = usePollCustomerLoginMutation();
  const busy = useRef(false);
  /** After a 429 the page waits before asking again (many customers on one IP). */
  const resumeAt = useRef(0);

  useEffect(() => {
    let stopped = false;
    const check = async () => {
      if (busy.current || stopped || document.visibilityState !== "visible") return;
      if (Date.now() < resumeAt.current) return;
      busy.current = true;
      try {
        const result = await poll({ slug: store.slug, id: challenge.id, secret: challenge.secret }).unwrap();
        if (!stopped && result.status === "verified") onVerified(result.customerToken);
      } catch (err) {
        const code = errorCode(err);
        if (!stopped && (code === "E_LOGIN_EXPIRED" || code === "E_LOGIN_NOT_FOUND")) onExpired();
        if ((err as { status?: unknown })?.status === 429) resumeAt.current = Date.now() + 20_000;
        // Anything else (a dropped connection): the next round asks again.
      } finally {
        busy.current = false;
      }
    };
    const timer = setInterval(() => void check(), POLL_MS);
    const onVisible = () => void check();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [challenge.id, challenge.secret, poll, onExpired, onVerified, store.slug]);

  return (
    <>
      <ol className="flex flex-col gap-2 text-sm">
        <li className="flex gap-2.5">
          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">1</span>
          {opened ? (
            <span>
              O WhatsApp abriu com a mensagem para a {store.name} já escrita. Não abriu? Toque em{" "}
              <span className="font-medium">Abrir o WhatsApp</span>.
            </span>
          ) : (
            <span>
              Toque em <span className="font-medium">Abrir o WhatsApp</span>: a mensagem para a {store.name} já vai
              escrita.
            </span>
          )}
        </li>
        <li className="flex gap-2.5">
          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">2</span>
          <span>Envie e volte para esta tela. Ela atualiza sozinha.</span>
        </li>
      </ol>
      <div className="flex items-center justify-between gap-3 rounded-xl bg-muted/50 px-3 py-2">
        <span className="text-xs text-muted-foreground">Código na mensagem</span>
        <span className="font-mono text-lg font-bold tracking-[0.25em]" aria-label={`Código ${challenge.code}`}>
          {challenge.code}
        </span>
      </div>
      {/* A real link (it leaves for WhatsApp in a new tab), styled as the main action. */}
      <a
        href={challenge.link}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          buttonVariants({ size: "lg", variant: opened ? "outline" : "default" }),
          "h-11 w-full rounded-full",
          !opened && WHATSAPP_BUTTON
        )}
      >
        <Icons.whatsapp /> Abrir o WhatsApp
      </a>
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Spinner /> Esperando sua mensagem…
        </p>
        <Button variant="ghost" size="sm" className="rounded-full text-muted-foreground" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Número da loja: {challenge.displayPhoneNumber}</p>
    </>
  );
}
