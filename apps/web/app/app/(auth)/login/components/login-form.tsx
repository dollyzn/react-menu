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
import { SocialLogin } from "./social-login";

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



  return (
    <div className="grid gap-6">
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

      <SocialLogin />
    </div>
  );
}
