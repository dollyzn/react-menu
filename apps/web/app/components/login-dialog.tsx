"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Eye, EyeOff, Loader2, Lock, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { LoginError, useSession } from "@/contexts/session-provider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

export const LoginSchema = z.object({
  email: z.email("Insira um e-mail válido").min(1, "Preencha com seu e-mail"),
  password: z.string().min(1, "Informe uma senha"),
});

export type LoginValues = z.infer<typeof LoginSchema>;

export function LoginDialog() {
  const { login, verify } = useSession();

  const [showPassword, setShowPassword] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const form = useForm<z.infer<typeof LoginSchema>>({
    resolver: zodResolver(LoginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });
  const { isSubmitting } = form.formState;

  async function onSubmit(data: z.infer<typeof LoginSchema>) {
    const { email, password } = data;

    try {
      await login({
        email,
        password,
      });
    } catch (err) {
      const error = err as LoginError;
      form.setError("email", {
        type: "manual",
        message: "",
      });
      form.setError("password", {
        type: "manual",
        message: error.invalidCredentials
          ? "E-mail ou senha inválidos."
          : "Erro no servidor. Tente novamente mais tarde.",
      });
    }
  }

  async function verifyUserSession() {
    setVerifyLoading(true);
    const loggedIn = await verify();
    setVerifyLoading(false);

    if (!loggedIn) setIsOpen(true);
  }

  return (
    <>
      <Button
        size="icon"
        variant="outline"
        disabled={verifyLoading}
        onClick={async () => {
          await verifyUserSession();
        }}
      >
        {verifyLoading ? <Loader2 className="animate-spin" /> : <User />}
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Login</DialogTitle>
            <DialogDescription>
              Digite suas credencias para acessar sua conta
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={form.handleSubmit(onSubmit)}>
            <FieldGroup>
              <Controller
                name="email"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="login-dialog-email">E-mail</FieldLabel>
                    <div className="relative">
                      <User
                        className="absolute left-3 top-1/2 -translate-y-1/2 transform text-gray-400"
                        size={18}
                      />
                      <Input
                        id="login-dialog-email"
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
                    <FieldLabel htmlFor="login-dialog-password">Senha</FieldLabel>
                    <div className="relative">
                      <Lock
                        className="absolute left-3 top-1/2 -translate-y-1/2 transform text-gray-400"
                        size={18}
                      />
                      <Input
                        id="login-dialog-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Sua senha"
                        className="pl-10"
                        autoComplete="off"
                        aria-invalid={fieldState.invalid}
                        {...field}
                        disabled={isSubmitting}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 transform text-gray-400"
                      >
                        {showPassword ? (
                          <EyeOff className="h-5 w-5" />
                        ) : (
                          <Eye className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />
            </FieldGroup>

            <Button
              className="mt-4 w-full"
              type="submit"
              loading={isSubmitting}
            >
              Entrar
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
