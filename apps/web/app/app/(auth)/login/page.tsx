import Link from "next/link";
import { LoginForm } from "./components/login-form";
import { AuthShell } from "../_components/auth-shell";

export default function LoginPage() {
  return (
    <AuthShell title="Menu App" description="Entre com suas credenciais para acessar o sistema">
          <LoginForm />

          <p className="px-2 sm:px-8 text-center text-sm text-muted-foreground">
            Ao continuar, você concorda com nossos{" "}
            <Link
              href="/terms"
              className="underline underline-offset-4 hover:text-primary"
            >
              Termos de Serviço
            </Link>{" "}
            e{" "}
            <Link
              href="/privacy"
              className="underline underline-offset-4 hover:text-primary"
            >
              Política de Privacidade
            </Link>
            .
          </p>
    </AuthShell>
  );
}
