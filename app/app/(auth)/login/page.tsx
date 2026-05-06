import Link from "next/link";
import { LoginForm } from "./components/login-form";
import { ThemeTogglerButton } from "@/components/animate-ui/components/buttons/theme-toggler";
import AnimatedBackground from "./components/animated-background";

export default function LoginPage() {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center md:grid lg:max-w-none lg:grid-cols-2 lg:px-0">
      <div className="absolute  right-4 top-4">
        <ThemeTogglerButton direction="tr-circle" />
      </div>

      <AnimatedBackground />

      <div className="mx-4 lg:p-8 lg:mx-0">
        <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[400px] lg:w-[350px] rounded-xl shadow-lg lg:shadow-none px-6 py-8 lg:p-0 border lg:border-0">
          <div className="flex flex-col space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight flex gap-3 items-center">
              Menu App
            </h1>
            <p className="text-sm text-muted-foreground">
              Entre com suas credenciais para acessar o sistema
            </p>
          </div>

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
        </div>
      </div>
    </main>
  );
}
