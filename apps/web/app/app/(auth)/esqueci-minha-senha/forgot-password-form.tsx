"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, MailCheck, Mail } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useForgotPasswordMutation } from "@/redux/features/auth/authApi";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [request, { isLoading }] = useForgotPasswordMutation();

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = email.trim();
    if (!EMAIL.test(value)) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    try {
      await request({ email: value }).unwrap();
      setSentTo(value);
    } catch {
      // baseApi shows the error (e.g. too many requests).
    }
  };

  if (sentTo) {
    return (
      <div className="space-y-4" role="status">
        <div className="flex items-start gap-3 rounded-xl border bg-muted/40 p-4">
          <MailCheck className="mt-0.5 size-5 shrink-0 text-primary" />
          <div className="space-y-1 text-sm">
            <p className="font-medium">Confira seu e-mail</p>
            <p className="text-muted-foreground">
              Se houver uma conta com <strong>{sentTo}</strong>, enviamos um link para redefinir a senha. Ele vale por
              1 hora. Não chegou? Veja a caixa de spam.
            </p>
          </div>
        </div>
        <Link href="/app/login" className={buttonVariants({ variant: "outline", className: "w-full" })}>
          <ArrowLeft /> Voltar ao login
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field data-invalid={invalid}>
        <FieldLabel htmlFor="forgot-email">E-mail</FieldLabel>
        <div className="relative">
          <Mail className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" size={18} />
          <Input
            id="forgot-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoFocus
            className="pl-10"
            placeholder="voce@exemplo.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={invalid}
          />
        </div>
        {invalid && <FieldError>Informe um e-mail válido.</FieldError>}
      </Field>
      <Button type="submit" className="w-full" loading={isLoading}>
        Enviar link
      </Button>
      <Link href="/app/login" className={buttonVariants({ variant: "ghost", className: "w-full" })}>
        <ArrowLeft /> Voltar ao login
      </Link>
    </form>
  );
}
