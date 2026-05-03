import Link from "next/link";
import { LoginForm } from "./components/login-form";
import { ThemeToggle } from "@/components/app/theme-toggle";

export default function LoginPage() {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center md:grid lg:max-w-none lg:grid-cols-2 lg:px-0">
      <div className="absolute  right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="relative hidden h-full flex-col bg-muted p-10 lg:flex dark:border-r">
        {/*     <AnimatedBackground /> */}
        <div className="relative z-20 flex justify-end items-center text-lg font-medium text-primary-foreground">
          FaleAlto CRM
        </div>
        <div className="relative z-20 mt-auto text-primary-foreground">
          <span className="text-sm">Equipe FaleAlto</span>
        </div>
      </div>
      <div className="mx-4 lg:p-8 lg:mx-0">
        <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[400px] lg:w-[350px] rounded-xl shadow-lg lg:shadow-none px-6 py-8 lg:p-0 border lg:border-0">
          <div className="flex flex-col space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight flex gap-3 items-center">
              FaleAlto
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
