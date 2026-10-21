import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "../_components/auth-shell";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = { title: "Redefinir senha" };

/** Also the landing page of staff invites (`?convite=1`). */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ convite?: string }>;
}) {
  const invite = (await searchParams).convite === "1";
  return (
    <AuthShell
      title={invite ? "Crie sua senha" : "Escolha uma nova senha"}
      description={
        invite
          ? "Você foi convidado para a equipe. Use pelo menos 8 caracteres; depois, entre com seu e-mail."
          : "Use pelo menos 8 caracteres. Depois, entre com ela."
      }
    >
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
