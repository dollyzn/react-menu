import Link from "next/link";
import type { ApiSuccess, SocialProvider } from "@react-menu/contracts";
import { serverApiBase, visitorHeaders } from "@/lib/server-api";
import { LoginForm } from "./components/login-form";
import { AuthShell } from "../_components/auth-shell";

/**
 * The social providers configured on the API, asked by the server so the
 * "Entrar com Google" button is in the first render (asked by the browser,
 * it popped in a moment after the page). Null when the API didn't answer:
 * the browser asks then.
 */
async function socialProviders(): Promise<SocialProvider[] | null> {
  try {
    const response = await fetch(`${serverApiBase()}auth/social/providers`, {
      headers: await visitorHeaders(),
      next: { revalidate: 300 },
    });
    if (!response.ok) return null;
    return ((await response.json()) as ApiSuccess<{ providers: SocialProvider[] }>).data.providers;
  } catch {
    return null;
  }
}

export default async function LoginPage() {
  const providers = await socialProviders();
  return (
    <AuthShell title="React Menu" description="Entre para abrir o painel da sua loja.">
          <LoginForm socialProviders={providers} />

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
