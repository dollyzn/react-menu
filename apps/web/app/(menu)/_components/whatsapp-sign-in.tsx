"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, KeyRound, LogOut, MessageCircle, ShieldCheck } from "lucide-react";
import type { CustomerLoginChallenge, PublicMenu } from "@react-menu/contracts";
import { CodeInput } from "@/components/app/auth/code-input";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { linkStore, unlinkStore } from "@/redux/slices/customer";
import {
  useClaimCustomerLoginMutation,
  useSignOutCustomerMutation,
  useStartCustomerLoginMutation,
} from "@/redux/features/public/publicApi";
import { formatPhoneBR } from "@/utils/string";
import { errorCode, getErrorMessage } from "@/utils/get-error-message";

type Store = Pick<PublicMenu["store"], "name" | "slug" | "whatsapp">;

/** How often the page asks whether the customer's message arrived. */
const POLL_MS = 2500;

/**
 * "Ver todos os meus pedidos" in one store (ADR 0025): the customer proves
 * the phone by sending a code from their WhatsApp (free for the store), or
 * by typing a code the store sends. The session it opens is kept per store
 * on this device; the list of orders above fills in as the confirmation.
 */
export function WhatsAppSignIn({ store, signedIn }: { store: Store; signedIn?: { name: string | null; phone: string } }) {
  const dispatch = useAppDispatch();
  const token = useAppSelector((state) => state.customer.tokens?.[store.slug]);
  const [signOut] = useSignOutCustomerMutation();

  if (token) {
    return (
      <div className="flex flex-col gap-3">
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" />
          <span>
            Vendo todos os seus pedidos na <span className="font-medium text-foreground">{store.name}</span>
            {signedIn && (
              <>
                {" "}
                como <span className="font-medium text-foreground">{signedIn.name ?? "você"}</span> · {signedIn.phone}
              </>
            )}
          </span>
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="self-start rounded-full text-muted-foreground"
          onClick={() => {
            void signOut({ slug: store.slug, token });
            dispatch(unlinkStore(store.slug));
          }}
        >
          <LogOut /> Sair neste aparelho
        </Button>
      </div>
    );
  }

  if (!store.whatsapp.login) return null;
  return <SignInFlow store={store} codeAvailable={store.whatsapp.login.code} />;
}

type Step =
  | { kind: "idle" }
  | { kind: "message"; challenge: Extract<CustomerLoginChallenge, { method: "message" }> }
  | { kind: "phone" }
  | { kind: "code"; challenge: Extract<CustomerLoginChallenge, { method: "code" }> };

function SignInFlow({ store, codeAvailable }: { store: Store; codeAvailable: boolean }) {
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

  const byMessage = async () => {
    setError(null);
    try {
      const challenge = await start({ slug: store.slug, input: { method: "message" } }).unwrap();
      if (challenge.method === "message") setStep({ kind: "message", challenge });
    } catch (err) {
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

  return (
    <div className="flex flex-col gap-3">
      {step.kind === "idle" && (
        <>
          <p className="text-sm text-muted-foreground">
            Entre com seu WhatsApp para ver aqui todos os seus pedidos na{" "}
            <span className="font-medium text-foreground">{store.name}</span>, de qualquer celular, inclusive os
            feitos no balcão.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button className="rounded-full" loading={starting} onClick={() => void byMessage()}>
              <MessageCircle /> Entrar pelo WhatsApp
            </Button>
            {codeAvailable && (
              <Button variant="ghost" className="rounded-full" onClick={() => setStep({ kind: "phone" })}>
                <KeyRound /> Receber um código
              </Button>
            )}
          </div>
        </>
      )}

      {step.kind === "message" && (
        <MessageStep
          store={store}
          challenge={step.challenge}
          onVerified={signedIn}
          onExpired={expired}
          onCancel={() => setStep({ kind: "idle" })}
        />
      )}

      {step.kind === "phone" && (
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void sendCode();
          }}
        >
          <Field data-invalid={Boolean(error)}>
            <FieldLabel htmlFor="history-phone">Seu celular (WhatsApp)</FieldLabel>
            <Input
              id="history-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              placeholder="(11) 98765-4321"
              value={phone}
              onChange={(event) => setPhone(formatPhoneBR(event.target.value))}
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" className="rounded-full" loading={starting}>
              Enviar código
            </Button>
            <Button type="button" variant="ghost" className="rounded-full" onClick={() => setStep({ kind: "idle" })}>
              <ArrowLeft /> Voltar
            </Button>
          </div>
        </form>
      )}

      {step.kind === "code" && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            Mandamos um código pelo WhatsApp para {step.challenge.phone}. Digite aqui:
          </p>
          <CodeInput
            value={code}
            onChange={setCode}
            onComplete={(value) => void checkCode(value)}
            state={error ? "error" : "idle"}
            shake={shake}
            disabled={claiming}
            autoFocus
          />
          <Button
            variant="ghost"
            size="sm"
            className="self-start rounded-full"
            onClick={() => setStep({ kind: "phone" })}
          >
            <ArrowLeft /> Trocar o número ou pedir outro
          </Button>
        </div>
      )}

      {error && <FieldError>{error}</FieldError>}
    </div>
  );
}

/**
 * The code to send and the button that writes it in WhatsApp; the page asks
 * every few seconds (and as soon as it is visible again, coming back from
 * WhatsApp) whether it arrived.
 */
function MessageStep({
  store,
  challenge,
  onVerified,
  onExpired,
  onCancel,
}: {
  store: Store;
  challenge: Extract<CustomerLoginChallenge, { method: "message" }>;
  onVerified: (token: string) => void;
  onExpired: () => void;
  onCancel: () => void;
}) {
  const [claim] = useClaimCustomerLoginMutation();
  const busy = useRef(false);

  useEffect(() => {
    let stopped = false;
    const check = async () => {
      if (busy.current || stopped || document.visibilityState !== "visible") return;
      busy.current = true;
      try {
        const result = await claim({ slug: store.slug, id: challenge.id, secret: challenge.secret }).unwrap();
        if (!stopped && result.status === "verified") onVerified(result.customerToken);
      } catch (err) {
        const code = errorCode(err);
        if (!stopped && (code === "E_LOGIN_EXPIRED" || code === "E_LOGIN_NOT_FOUND")) onExpired();
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
  }, [challenge.id, challenge.secret, claim, onExpired, onVerified, store.slug]);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Envie a mensagem que já vai escrita para a {store.name} ({challenge.displayPhoneNumber}). Ela confirma que o
        número é seu.
      </p>
      <p className="text-center text-2xl font-black tracking-[0.3em] tabular-nums" aria-label={`Código ${challenge.code}`}>
        {challenge.code}
      </p>
      {/* A real link (it leaves for WhatsApp in a new tab), styled as the main action. */}
      <a
        href={challenge.link}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(buttonVariants(), "rounded-full bg-[#25D366] text-white hover:bg-[#1ebe5b]")}
      >
        <MessageCircle /> Abrir o WhatsApp
      </a>
      <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
        <Spinner /> Esperando sua mensagem…
      </p>
      <Button variant="ghost" size="sm" className="self-start rounded-full" onClick={onCancel}>
        <ArrowLeft /> Voltar
      </Button>
    </div>
  );
}
