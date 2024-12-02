"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Eye, EyeOff, Loader2, Lock, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { LoginSchema } from "@/schema";
import { LoginError, useSession } from "@/providers/session-provider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTrigger,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { verify } from "crypto";

export function LoginDialog() {
  const router = useRouter();
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

      router.push("/manage");
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

    if (loggedIn) router.push("/manage");
    else setIsOpen(true);
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

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-mail</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <User
                          className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                          size={18}
                        />
                        <Input
                          placeholder="Seu e-mail de acesso"
                          className="pl-10"
                          {...field}
                          disabled={isSubmitting}
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
                  <FormItem className="my-4">
                    <FormLabel>Senha</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Lock
                          className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                          size={18}
                        />
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="Sua senha"
                          className="pl-10"
                          autoComplete="off"
                          {...field}
                          disabled={isSubmitting}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                        >
                          {showPassword ? (
                            <EyeOff className="h-5 w-5" />
                          ) : (
                            <Eye className="h-5 w-5" />
                          )}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                className="w-full mt-4"
                type="submit"
                loading={isSubmitting}
              >
                Entrar
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
