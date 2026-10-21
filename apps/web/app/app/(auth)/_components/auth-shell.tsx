import { ThemeToggleButton } from "@/components/app/theme-toggle-button";
import AnimatedBackground from "../login/components/animated-background";

/** Login, "esqueci minha senha" and "redefinir senha" share this frame. */
export function AuthShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center md:grid lg:max-w-none lg:grid-cols-2 lg:px-0">
      <div className="absolute right-4 top-4">
        <ThemeToggleButton variant="default" />
      </div>

      <AnimatedBackground />

      <div className="mx-4 lg:mx-0 lg:p-8">
        <div className="mx-auto flex w-full flex-col justify-center space-y-6 rounded-xl border px-6 py-8 shadow-lg sm:w-[400px] lg:w-[350px] lg:border-0 lg:p-0 lg:shadow-none">
          <div className="flex flex-col space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          {children}
        </div>
      </div>
    </main>
  );
}
