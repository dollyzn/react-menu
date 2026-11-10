"use client";

import { Suspense, useEffect, useEffectEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ShieldAlert } from "lucide-react";
import type { SocialProvider } from "@react-menu/contracts";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldSeparator } from "@/components/ui/field";
import { Icons } from "@/components/app/icons";
import { useSession } from "@/contexts/session-provider";
import { useSocialProvidersQuery } from "@/redux/features/auth/authApi";
import {
  SOCIAL_AUTH_CHANNEL,
  openSocialPopup,
  prefersFullPageLogin,
  type SocialAuthMessage,
} from "@/lib/social-auth";
import { enterPanel } from "@/lib/enter-panel";

const START_URL = "/app/social?provider=google";
/** A sign-in left open this long frees the form again (the popup may be long gone). */
const GIVE_UP_AFTER_MS = 5 * 60_000;
/** The session cookie is already set when the popup reports: retry a dropped connection. */
const VERIFY_RETRIES_MS = [0, 1_000, 3_000];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** idle → waiting (popup open) → finishing (popup reported, loading the session). */
export type SocialLoginStatus = "idle" | "waiting" | "finishing";

/**
 * "Entrar com Google", shown only when the server has Google credentials.
 * Opens the provider in a popup (the login page stays put) and falls back
 * to a full-page redirect when popups are blocked or in the installed app.
 */
export function SocialLogin(props: {
  /** From the server render; null: ask the API from the browser. */
  providers: SocialProvider[] | null;
  /** The e-mail login is running. */
  disabled?: boolean;
  onStatusChange?: (status: SocialLoginStatus) => void;
  /** Google passed and the second step is due (its cookie is set). */
  onTwoFactor?: () => void;
}) {
  // useSearchParams needs a Suspense boundary for static prerendering.
  return (
    <Suspense fallback={null}>
      <GoogleLogin {...props} />
    </Suspense>
  );
}

function GoogleLogin({
  providers,
  disabled,
  onStatusChange,
  onTwoFactor,
}: {
  providers: SocialProvider[] | null;
  disabled?: boolean;
  onStatusChange?: (status: SocialLoginStatus) => void;
  /** Google passed and the second step is due (its cookie is set). */
  onTwoFactor?: () => void;
}) {
  const router = useRouter();
  // Errors of the full-page flow come back as ?erro=.
  const redirectError = useSearchParams().get("erro");
  const { verify } = useSession();
  const { data } = useSocialProvidersQuery(undefined, { skip: providers !== null });
  const [status, setStatusState] = useState<SocialLoginStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const setStatus = (next: SocialLoginStatus) => {
    setStatusState(next);
    onStatusChange?.(next);
  };

  const finish = async (message: SocialAuthMessage) => {
    if (message.type === "two-factor") {
      setStatus("idle");
      onTwoFactor?.();
      return;
    }
    if (message.type === "error") {
      setError(message.error);
      setStatus("idle");
      return;
    }
    setError(null);
    setStatus("finishing");
    for (const wait of VERIFY_RETRIES_MS) {
      if (wait) await sleep(wait);
      if (await verify()) {
        enterPanel();
        return;
      }
    }
    setError("Não foi possível entrar. Tente de novo.");
    setStatus("idle");
  };

  // The popup can't be watched: the provider's pages cut it off from this
  // page (COOP), so `closed` turns true while the sign-in goes on. Listen
  // the whole time instead, even after "Cancelar", so a sign-in finished
  // late still lands here.
  const onMessage = useEffectEvent((message: SocialAuthMessage) => void finish(message));
  useEffect(() => {
    const channel = new BroadcastChannel(SOCIAL_AUTH_CHANNEL);
    channel.onmessage = (event: MessageEvent<SocialAuthMessage>) => onMessage(event.data);
    return () => channel.close();
  }, []);

  const giveUp = useEffectEvent(() => setStatus("idle"));
  useEffect(() => {
    if (status !== "waiting") return;
    const timer = window.setTimeout(giveUp, GIVE_UP_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [status]);

  if (!(providers ?? data?.providers)?.includes("google")) return null;
  const shownError = error ?? redirectError;

  const start = () => {
    setError(null);
    if (redirectError) router.replace("/app/login");
    if (prefersFullPageLogin() || !openSocialPopup(START_URL)) {
      router.push(START_URL);
      return;
    }
    setStatus("waiting");
  };

  return (
    <div className="grid gap-4">
      <FieldSeparator>ou</FieldSeparator>
      {shownError && (
        <Alert variant="destructive">
          <ShieldAlert />
          <AlertTitle>Não foi possível entrar com o Google</AlertTitle>
          <AlertDescription>{shownError}</AlertDescription>
        </Alert>
      )}
      <div className="grid gap-2">
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="w-full gap-3 bg-background font-medium"
          onClick={start}
          loading={status !== "idle"}
          disabled={disabled}
        >
          {status === "idle" && <Icons.googleColor className="size-5" aria-hidden />}
          {status === "finishing" ? "Entrando…" : "Entrar com Google"}
        </Button>
        <AnimatePresence initial={false}>
          {status === "waiting" && (
            <motion.div
              key="waiting"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <p
                role="status"
                className="flex flex-wrap items-center justify-center gap-x-1 text-center text-xs text-muted-foreground"
              >
                Conclua o login na janela do Google.
                <Button type="button" variant="link" size="xs" className="px-0.5" onClick={start}>
                  Abrir de novo
                </Button>
                ·
                <Button type="button" variant="link" size="xs" className="px-0.5" onClick={() => setStatus("idle")}>
                  Cancelar
                </Button>
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
