import type { Metadata } from "next";
import { AuthShell } from "../_components/auth-shell";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = { title: "Esqueci minha senha" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Esqueceu a senha?"
      description="Informe o e-mail da sua conta e enviamos um link para escolher uma nova."
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
