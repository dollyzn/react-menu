"use client";

import { useSession } from "@/contexts/session-provider";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowBigUpDash, Eye, EyeOff, Lock, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import * as z from "zod";
import { AnimatePresence, motion } from "motion/react";
import type { TwoFactorChallenge } from "@react-menu/contracts";
import { useLazyTwoFactorChallengeQuery, useTwoFactorChallengeQuery } from "@/redux/features/auth/authApi";
import { SocialLogin, type SocialLoginStatus } from "./social-login";
import { TwoFactorStep } from "./two-factor-step";

export const LoginSchema = z.object({
  email: z.email("Insira um e-mail válido").min(1, "Preencha com seu e-mail"),
  password: z.string().min(1, "Informe uma senha"),
});

export type LoginValues = z.infer<typeof LoginSchema>;

export function LoginForm() {
  const router = useRouter();

  const { login } = useSession();

  const [showPassword, setShowPassword] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [socialStatus, setSocialStatus] = useState<SocialLoginStatus>("idle");
  /** The password (or Google) passed: the second step is on screen. */
  const [challenge, setChallenge] = useState<TwoFactorChallenge | null>(null);
  const [loadChallenge] = useLazyTwoFactorChallengeQuery();

  // After Google: the API set the challenge cookie; ask what it is.
  const continueWithCode = async () => {
    const result = await loadChallenge();
    if (result.data) setChallenge(result.data.twoFactor);
  };

  // Google without a popup comes back here with ?etapa=codigo (read once;
  // the server render has no window and nothing to show yet either way).
  const [cameFromGoogle] = useState(
    () => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("etapa") === "codigo"
  );
  const arrival = useTwoFactorChallengeQuery(undefined, { skip: !cameFromGoogle });
  const [arrivalDone, setArrivalDone] = useState(false);
  const current = challenge ?? (arrivalDone ? null : (arrival.data?.twoFactor ?? null));
  useEffect(() => {
    if (cameFromGoogle) window.history.replaceState(null, "", "/app/login");
  }, [cameFromGoogle]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e instanceof KeyboardEvent)
        setCapsLockOn(e.getModifierState("CapsLock"));
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e instanceof KeyboardEvent)
        setCapsLockOn(e.getModifierState("CapsLock"));
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  const form = useForm<LoginValues>({
    resolver: zodResolver(LoginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });
  const { isSubmitting } = form.formState;
  // One sign-in at a time: the Google popup is open (or finishing). It never
  // locks for good: "Cancelar" and a timeout free the form.
  const locked = isSubmitting || socialStatus !== "idle";

  async function onSubmit(data: LoginValues) {
    const { email, password } = data;

    const { error, twoFactor } = await login({
      email,
      password,
    });

    if (twoFactor) {
      setChallenge(twoFactor);
    } else if (error) {
      form.setError("email", {
        type: "manual",
        message: "",
      });
      form.setError("password", {
        type: "manual",
        message: error,
      });
    } else {
      router.push("/app/stores");
    }
  }



  return (
    // The steps slide sideways: clip them (no horizontal scroll).
    <div className="-mx-1 overflow-x-clip px-1">
    <AnimatePresence mode="wait" initial={false}>
      {current ? (
        <motion.div
          key="two-factor"
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 24 }}
          transition={{ duration: 0.2 }}
        >
          <TwoFactorStep
            challenge={current}
            onBack={() => {
              setChallenge(null);
              setArrivalDone(true);
              form.resetField("password");
            }}
          />
        </motion.div>
      ) : (
        <motion.div
          key="password"
          className="grid gap-6"
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.2 }}
        >
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <FieldGroup className="pb-6">
          <Controller
            name="email"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="login-email">E-mail</FieldLabel>
                <div className="relative">
                  <User
                    className="absolute left-3 top-1/2 -translate-y-1/2 transform text-muted-foreground"
                    size={18}
                  />
                  <Input
                    id="login-email"
                    placeholder="Seu e-mail de acesso"
                    className="pl-10"
                    aria-invalid={fieldState.invalid}
                    {...field}
                    disabled={locked}
                  />
                </div>
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          <Controller
            name="password"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <div className="flex w-full items-center justify-between gap-2">
                  <FieldLabel htmlFor="login-password">Senha</FieldLabel>
                  <Link
                    href="/app/esqueci-minha-senha"
                    className="text-xs text-primary underline-offset-4 hover:underline"
                  >
                    Esqueceu a senha?
                  </Link>
                </div>
                <div className="relative">
                  <Lock
                    className="absolute left-3 top-1/2 -translate-y-1/2 transform text-muted-foreground"
                    size={18}
                  />
                  <Input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Sua senha"
                    className={cn("pl-10 pr-10", capsLockOn && "pr-16")}
                    autoComplete="off"
                    aria-invalid={fieldState.invalid}
                    {...field}
                    disabled={locked}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={locked}
                    className="absolute right-3 top-1/2 -translate-y-1/2 transform text-muted-foreground"
                  >
                    {showPassword ? (
                      <EyeOff className="size-5" />
                    ) : (
                      <Eye className="size-5" />
                    )}
                    <span className="sr-only">
                      {showPassword ? "Esconder senha" : "Mostrar senha"}
                    </span>
                  </button>
                  <TooltipProvider>
                    {capsLockOn && (
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <div className="absolute right-10 top-1/2 -translate-y-1/2 transform text-muted-foreground" />
                          }
                        >
                          <ArrowBigUpDash className="size-5" />
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          <p>Caps Lock está ativado</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </TooltipProvider>
                </div>
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
        </FieldGroup>

        <Button
          type="submit"
          size="lg"
          className="w-full cursor-pointer"
          loading={isSubmitting}
          disabled={socialStatus !== "idle"}
        >
          Entrar
        </Button>
      </form>

      <SocialLogin
        disabled={isSubmitting}
        onStatusChange={setSocialStatus}
        onTwoFactor={() => void continueWithCode()}
      />
        </motion.div>
      )}
    </AnimatePresence>
    </div>
  );
}
