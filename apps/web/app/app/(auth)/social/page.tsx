"use client";

import { Suspense, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import type { SocialProvider } from "@react-menu/contracts";
import { useSession } from "@/contexts/session-provider";
import { Icons } from "@/components/app/icons";
import { getApiBaseUrl } from "@/lib/api-base-url";
import { SOCIAL_AUTH_CHANNEL, SOCIAL_AUTH_MODE_KEY, type SocialAuthMessage } from "@/lib/social-auth";

/** useSearchParams needs a Suspense boundary for static prerendering. */
export default function AuthSocialPage() {
  return (
    <Suspense fallback={null}>
      <AuthSocial />
    </Suspense>
  );
}

function readMode() {
  try {
    return sessionStorage.getItem(SOCIAL_AUTH_MODE_KEY);
  } catch {
    return null;
  }
}

/**
 * Both ends of the social login. Opened with `?provider=` it sends the
 * browser to the provider through the API; the API's callback brings it back here (with
 * `?error=` when it failed). In a popup the result goes to the login page
 * over a BroadcastChannel (the provider's pages may drop `window.opener`)
 * and the popup closes; as a full page (popup blocked, installed app) it
 * navigates by itself.
 */
function AuthSocial() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const provider = searchParams.get("provider") as SocialProvider | null;
  const error = searchParams.get("error");
  const { verify } = useSession();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const finish = (message: SocialAuthMessage) => {
      if (readMode() === "popup") {
        const channel = new BroadcastChannel(SOCIAL_AUTH_CHANNEL);
        channel.postMessage(message);
        channel.close();
        window.close();
        return;
      }
      if (message.type === "success") router.replace("/app/stores");
      else router.replace(`/app/login?erro=${encodeURIComponent(message.error)}`);
    };

    function start(provider: SocialProvider) {
      try {
        sessionStorage.setItem(SOCIAL_AUTH_MODE_KEY, window.opener ? "popup" : "page");
      } catch {
        // Without storage the page mode still works.
      }
      // The API sends the browser on to the provider and keeps the CSRF state
      // in a cookie for its callback (a fetched URL would leave that out).
      window.location.replace(new URL(`auth/social/${provider}/redirect`, getApiBaseUrl()));
    }

    async function complete() {
      if (error) {
        finish({ type: "error", error });
        return;
      }
      const user = await verify();
      finish(user ? { type: "success" } : { type: "error", error: "Não foi possível entrar. Tente de novo." });
    }

    if (provider) start(provider);
    else void complete();
  }, [provider, error, verify, router]);

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex min-h-screen flex-col items-center justify-center gap-2 bg-background p-6 text-center text-foreground"
    >
      <div className="relative">
        <div className="absolute inset-0 animate-pulse rounded-full bg-primary blur-xl" />
        <Icons.logo className="size-8 fill-primary" />
      </div>

      <div role="status">
        <p className="text-2xl font-semibold">
          Entrando <span className="animate-ping [animation-delay:-0.3s]">.</span>
          <span className="animate-ping [animation-delay:-0.15s]">.</span>
          <span className="animate-ping">.</span>
        </p>
        <p className="text-sm text-muted-foreground">Aguarde um instante.</p>
      </div>
    </motion.main>
  );
}
