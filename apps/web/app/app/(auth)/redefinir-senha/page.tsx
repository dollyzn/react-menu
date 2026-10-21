import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "../_components/auth-shell";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = { title: "Redefinir senha" };

export default function ResetPasswordPage() {
  return (
    <AuthShell title="Escolha uma nova senha" description="Use pelo menos 8 caracteres. Depois, entre com ela.">
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
