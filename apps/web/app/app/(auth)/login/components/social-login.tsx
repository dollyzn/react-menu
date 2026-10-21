"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ShieldAlert } from "lucide-react";
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

const START_URL = "/app/social?provider=google";

/**
 * "Entrar com Google", shown only when the server has Google credentials.
 * Opens the provider in a popup (the login page stays put) and falls back
 * to a full-page redirect when popups are blocked or in the installed app.
 */
export function SocialLogin() {
  // useSearchParams needs a Suspense boundary for static prerendering.
  return (
    <Suspense fallback={null}>
      <GoogleLogin />
    </Suspense>
  );
}

function GoogleLogin() {
  const router = useRouter();
  // Errors of the full-page flow come back as ?erro=.
  const redirectError = useSearchParams().get("erro");
  const { verify } = useSession();
  const { data } = useSocialProvidersQuery();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cleanup = useRef<() => void>(undefined);

  useEffect(() => () => cleanup.current?.(), []);

  if (!data?.providers.includes("google")) return null;
  const shownError = error ?? redirectError;

  const start = () => {
    setError(null);
    if (redirectError) router.replace("/app/login");
    if (prefersFullPageLogin()) {
      router.push(START_URL);
      return;
    }
    const popup = openSocialPopup(START_URL);
    if (!popup) {
      router.push(START_URL);
      return;
    }
    setLoading(true);
    cleanup.current?.();

    const channel = new BroadcastChannel(SOCIAL_AUTH_CHANNEL);
    // Only stops the spinner: the provider's pages may cut the popup off
    // (COOP), which reads as closed while the sign-in goes on, so the
    // channel keeps listening.
    const closedCheck = window.setInterval(() => {
      if (!popup.closed) return;
      window.clearInterval(closedCheck);
      setLoading(false);
    }, 500);
    const done = () => {
      window.clearInterval(closedCheck);
      channel.close();
      cleanup.current = undefined;
      setLoading(false);
    };
    cleanup.current = done;

    channel.onmessage = async (event: MessageEvent<SocialAuthMessage>) => {
      done();
      if (event.data.type === "error") {
        setError(event.data.error);
        return;
      }
      if (await verify()) router.push("/app/stores");
      else setError("Não foi possível entrar. Tente de novo.");
    };
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
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="w-full gap-3 bg-background font-medium"
        onClick={start}
        loading={loading}
      >
        {!loading && <Icons.googleColor className="size-5" aria-hidden />}
        Entrar com Google
      </Button>
    </div>
  );
}
