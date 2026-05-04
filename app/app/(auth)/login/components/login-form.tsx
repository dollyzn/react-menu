"use client";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useSession } from "@/contexts/session-provider";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowBigUpDash,
  Eye,
  EyeOff,
  Lock,
  ShieldUser,
  User,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { Field, FieldSeparator } from "@/components/ui/field";
import { Icons } from "@/components/app/icons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useTheme } from "next-themes";
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
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="space-y-4 pb-6">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>E-mail</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <User
                        className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground"
                        size={18}
                      />
                      <Input
                        placeholder="Seu e-mail de acesso"
                        className="pl-10"
                        {...field}
                        disabled={
                          isSubmitting
                          //  || !!loading
                        }
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel asChild>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">Senha</Label>

                      <Button
                        variant="link"
                        className="p-0 h-auto text-xs text-primary"
                        type="button"
                        asChild
                      >
                        <Link href="/esqueci-minha-senha">
                          Esqueceu a senha?
                        </Link>
                      </Button>
                    </div>
                  </FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Lock
                        className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground"
                        size={18}
                      />
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="Sua senha"
                        className={cn("pl-10 pr-10", capsLockOn && "pr-16")}
                        autoComplete="off"
                        {...field}
                        disabled={
                          isSubmitting
                          //  || !!loading
                        }
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground"
                      >
                        {showPassword ? (
                          <EyeOff className="h-5 w-5" />
                        ) : (
                          <Eye className="h-5 w-5" />
                        )}
                        <span className="sr-only">
                          {showPassword ? "Esconder senha" : "Mostrar senha"}
                        </span>
                      </button>
                      <TooltipProvider>
                        {capsLockOn && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="absolute right-10 top-1/2 transform -translate-y-1/2 text-muted-foreground">
                                <ArrowBigUpDash className="size-5" />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                              <p>Caps Lock está ativado</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </TooltipProvider>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <Button
            type="submit"
            size="lg"
            className="w-full cursor-pointer"
            loading={isSubmitting}
            // disabled={!!loading}
          >
            Entrar
          </Button>
        </form>
      </Form>

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
