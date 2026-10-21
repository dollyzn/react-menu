import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatusScreenProps {
  icon: LucideIcon;
  /** Big faded number behind the icon (404, 500...). */
  code?: string;
  title: string;
  description: React.ReactNode;
  /** Shown small under the actions, e.g. the error digest to match server logs. */
  reference?: string;
  /** Action buttons/links. */
  children?: React.ReactNode;
  className?: string;
}

/**
 * Full-area message for not found and error pages. Server-safe (no hooks),
 * so both `not-found.tsx` and the client `error.tsx` boundaries use it.
 */
export function StatusScreen({
  icon: Icon,
  code,
  title,
  description,
  reference,
  children,
  className,
}: StatusScreenProps) {
  return (
    <main
      className={cn(
        "flex min-h-dvh w-full flex-col items-center justify-center px-4 py-12 text-center",
        className
      )}
    >
      <div className="relative mb-6 flex items-center justify-center">
        {code && (
          <span
            aria-hidden
            className="pointer-events-none absolute select-none font-heading text-[7rem] leading-none font-bold tracking-tighter text-primary/10 sm:text-[9rem]"
          >
            {code}
          </span>
        )}
        <span className="relative flex size-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25">
          <Icon className="size-8" aria-hidden />
        </span>
      </div>

      <h1 className="font-heading text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
        {title}
      </h1>
      <div className="mt-3 max-w-md text-sm/relaxed text-balance text-muted-foreground sm:text-base/relaxed">
        {description}
      </div>

      {children && (
        <div className="mt-8 flex w-full max-w-xs flex-col gap-2 sm:max-w-none sm:flex-row sm:justify-center">
          {children}
        </div>
      )}

      {reference && (
        <p className="mt-6 font-mono text-xs text-muted-foreground/70">
          Código: {reference}
        </p>
      )}
    </main>
  );
}
