"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "@/contexts/session-provider";
import { Icons } from "@/components/app/icons";
import { delay, motion } from "motion/react";
import { request } from "@/lib/api";

export default function AuthSocialPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const provider = searchParams.get("provider") as "google" | "linkedin" | null;
  const error = searchParams.get("error");
  const { verify } = useSession();

  useEffect(() => {
    async function startAuth() {
      if (!provider) return;

      const response = await request<{ url: string }>({
        url: `/auth/social/${provider}/redirect`,
      });

      if (!response.success || !response.url) {
        window.opener?.postMessage(
          { type: "SOCIAL_AUTH_ERROR", error: "Falha ao iniciar login." },
          window.location.origin
        );
        window.close();
        return;
      }

      window.location.href = response.url;
    }

    startAuth();
  }, [provider]);

  useEffect(() => {
    async function handleCallback() {
      if (error) {
        window.opener?.postMessage(
          {
            type: "SOCIAL_AUTH_ERROR",
            error,
          },
          window.location.origin
        );

        window.close();
        return;
      }

      const user = await verify();

      if (!user) {
        window.opener?.postMessage(
          {
            type: "SOCIAL_AUTH_ERROR",
            error: "Não foi possível autenticar sua conta.",
          },
          window.location.origin
        );

        window.close();
        setTimeout(() => router.replace("/auth/login"), 500);
        return;
      }

      window.opener?.postMessage(
        {
          type: "SOCIAL_AUTH_SUCCESS",
        },
        window.location.origin
      );

      window.close();
    }

    if (!provider) {
      delay(handleCallback, 2500);
    }
  }, [provider, error, verify, router]);

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen flex flex-col items-center justify-center text-center p-6 space-y-2 bg-background text-foreground"
    >
      <div className="relative">
        <div className="absolute inset-0 bg-primary rounded-full blur-xl animate-pulse" />
        <Icons.logo className="size-8 fill-primary" />
      </div>

      <div>
        <p className="text-2xl font-semibold items-center">
          Autenticando{" "}
          <span className="animate-ping [animation-delay:-0.3s]">.</span>
          <span className="animate-ping [animation-delay:-0.15s]">.</span>
          <span className="animate-ping">.</span>
        </p>
        <p className="text-sm text-muted-foreground">Aguarde um instante.</p>
      </div>
    </motion.main>
  );
}
