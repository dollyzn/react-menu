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

export const LoginSchema = z.object({
  email: z.email("Insira um e-mail válido").min(1, "Preencha com seu e-mail"),
  password: z.string().min(1, "Informe uma senha"),
});

export type LoginValues = z.infer<typeof LoginSchema>;

export function LoginForm() {
  const router = useRouter();
  //const { resolvedTheme } = useTheme();

  const { login } = useSession();

  // const [loading, setLoading] = useState<"google" | "linkedin" | null>(null);
  // const [socialAuthError, setSocialAuthError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);

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

  async function onSubmit(data: LoginValues) {
    const { email, password } = data;

    const error = await login({
      email,
      password,
    });

    if (error) {
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

  /* async function startSocialLogin(provider: "google" | "linkedin") {
    setSocialAuthError(null);
    setLoading(provider);

    const popup = openCenteredPopup(provider, "socialLogin", 800, 600);

    if (!popup) {
      setLoading(null);
      setSocialAuthError("Não foi possível abrir o popup de autenticação.");
      return;
    }

    const popupChecker = setInterval(() => {
      if (popup.closed) {
        clearInterval(popupChecker);
        window.removeEventListener("message", listener);
        setLoading(null);
      }
    }, 300);

    const listener = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      if (event.data.type === "SOCIAL_AUTH_SUCCESS") {
        clearInterval(popupChecker);
        window.removeEventListener("message", listener);

        const user = await verify();

        if (!user) {
          setSocialAuthError("Não foi possível autenticar sua conta.");
          popup.close();
          setLoading(null);
          return;
        }

        popup.close();
        router.push("/");
        setLoading(null);
      }

      if (event.data.type === "SOCIAL_AUTH_ERROR") {
        clearInterval(popupChecker);
        window.removeEventListener("message", listener);

        const { error } = event.data;
        setSocialAuthError(error || "Erro desconhecido ao autenticar.");

        popup.close();
        setLoading(null);
      }
    };

    window.addEventListener("message", listener);
  } */

  /* function openCenteredPopup(
    provider: "google" | "linkedin",
    title: string,
    w: number,
    h: number
  ) {
    const dualScreenLeft =
      window.screenLeft !== undefined ? window.screenLeft : window.screenX;
    const dualScreenTop =
      window.screenTop !== undefined ? window.screenTop : window.screenY;

    const width = window.innerWidth
      ? window.innerWidth
      : document.documentElement.clientWidth;
    const height = window.innerHeight
      ? window.innerHeight
      : document.documentElement.clientHeight;

    const left = width / 2 - w / 2 + dualScreenLeft;
    const top = height / 2 - h / 2 + dualScreenTop;

    const popup = window.open(
      "",
      title,
      `
      width=${w},
      height=${h},
      top=${top + 80},
      left=${left},
      resizable=yes,
      scrollbars=yes,
      toolbar=no,
      location=no,
      menubar=no,
      status=no
    `
    );

    if (!popup) return null;

    try {
      popup.focus();

      const doc = popup.document;

      doc.open();
      doc.close();

      const isDark = resolvedTheme === "dark";
      doc.documentElement.style.background = isDark ? "#0a0a0a" : "#ffffff";
      doc.documentElement.innerHTML = `
        <head>
          <meta charset="UTF-8" />
          <meta http-equiv="refresh" content="0;url=/auth/social?provider=${provider}" />
        </head>
        <body>
        </body>
      `;
    } catch (error) {
      try {
        popup.location.href = `/auth/social?provider=${provider}`;
      } catch {
        popup.close();
        return null;
      }
    }

    return popup;
  } */

  return (
    <div className="grid gap-6">
      {/*       {socialAuthError && (
        <Alert variant="destructive">
          <ShieldUser />
          <AlertTitle>Não foi possível processar sua solicitação</AlertTitle>
          <AlertDescription>{socialAuthError}</AlertDescription>
        </Alert>
      )} */}
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
                    disabled={isSubmitting}
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
                  <Button
                    variant="link"
                    className="h-auto p-0 text-xs text-primary"
                    type="button"
                    nativeButton={false}
                    render={<Link href="/esqueci-minha-senha" />}
                  >
                    Esqueceu a senha?
                  </Button>
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
                    disabled={isSubmitting}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
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
        >
          Entrar
        </Button>
      </form>

      {/* <FieldSeparator>Ou continue com </FieldSeparator>

          <Field className="grid gap-4 sm:grid-cols-2">
        <Button
          variant="outline"
          type="button"
          onClick={() => startSocialLogin("google")}
          loading={loading === "google"}
          disabled={!!loading}
        >
          {loading !== "google" && (
            <Icons.google className="fill-current size-4" />
          )}
          Google
        </Button>
        <Button
          variant="outline"
          type="button"
          onClick={() => startSocialLogin("linkedin")}
          loading={loading === "linkedin"}
          disabled={!!loading}
        >
          {loading !== "linkedin" && (
            <Icons.linkedin className="fill-current size-4 mb-0.5" />
          )}
          LinkedIn
        </Button>
      </Field> */}
    </div>
  );
}
