"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, CheckCircle2, Eye, EyeOff, Lock } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useResetPasswordMutation } from "@/redux/features/auth/authApi";

export function ResetPasswordForm() {
  const params = useSearchParams();
  const token = params.get("token");
  const invite = params.get("convite") === "1";
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [visible, setVisible] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [reset, { isLoading, error }] = useResetPasswordMutation();
  const linkInvalid =
    !token ||
    (error && "data" in error && (error.data as { code?: string } | undefined)?.code === "E_RESET_TOKEN_INVALID");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password.length < 8) return setProblem("Use pelo menos 8 caracteres.");
    if (password !== confirmation) return setProblem("As senhas não são iguais.");
    setProblem(null);
    try {
      await reset({ token: token!, password }).unwrap();
      setDone(true);
    } catch (err) {
      // An invalid link has its own screen below; anything else is shown here.
      const code = (err as { data?: { code?: string } }).data?.code;
      if (code !== "E_RESET_TOKEN_INVALID") setProblem("Não foi possível salvar agora. Tente de novo.");
    }
  };

  if (done) {
    return (
      <div className="space-y-4" role="status">
        <div className="flex items-start gap-3 rounded-xl border bg-muted/40 p-4 text-sm">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />
          <p>
            <span className="font-medium">{invite ? "Senha criada." : "Senha redefinida."}</span>{" "}
            <span className="text-muted-foreground">
              {invite ? "Entre com seu e-mail e a nova senha." : "Por segurança, encerramos as sessões abertas em outros aparelhos."}
            </span>
          </p>
        </div>
        <Link href="/app/login" className={buttonVariants({ className: "w-full" })}>
          Entrar
        </Link>
      </div>
    );
  }

  if (linkInvalid) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertDescription>
            {token ? "Este link expirou ou já foi usado." : "Link incompleto."}{" "}
            {invite ? "Peça um novo convite à gerência da loja, ou" : ""} peça um novo link para definir a senha.
          </AlertDescription>
        </Alert>
        <Link href="/app/esqueci-minha-senha" className={buttonVariants({ className: "w-full" })}>
          Pedir novo link
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field data-invalid={Boolean(problem)}>
        <FieldLabel htmlFor="new-password">Nova senha</FieldLabel>
        <div className="relative">
          <Lock className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" size={18} />
          <Input
            id="new-password"
            type={visible ? "text" : "password"}
            autoComplete="new-password"
            autoFocus
            className="pr-10 pl-10"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="absolute top-1/2 right-1 -translate-y-1/2"
            aria-label={visible ? "Esconder senha" : "Mostrar senha"}
            onClick={() => setVisible((value) => !value)}
          >
            {visible ? <EyeOff /> : <Eye />}
          </Button>
        </div>
      </Field>
      <Field data-invalid={Boolean(problem)}>
        <FieldLabel htmlFor="confirm-password">Repita a nova senha</FieldLabel>
        <Input
          id="confirm-password"
          type={visible ? "text" : "password"}
          autoComplete="new-password"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
        />
        {problem && <FieldError>{problem}</FieldError>}
      </Field>
      <Button type="submit" className="w-full" loading={isLoading}>
        Salvar nova senha
      </Button>
    </form>
  );
}
