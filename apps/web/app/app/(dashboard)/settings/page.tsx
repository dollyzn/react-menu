"use client";

import type { ReactNode } from "react";
import { Check, LogOut, Monitor, Moon, Palette, Sun } from "lucide-react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/app/layout/page-header";
import { Radio } from "@base-ui/react/radio";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup } from "@/components/ui/radio-group";
import { useSession } from "@/contexts/session-provider";
import { useHydrated } from "@/hooks/use-hydrated";
import { useThemeTransition, type ThemeChoice } from "@/hooks/use-theme-transition";
import { env } from "@/lib/env";
import { cn } from "@/lib/utils";
import { redirectToLogout } from "@/utils/navigation";
import { NotificationPreferencesCard } from "./components/notification-preferences-card";
import { PasswordCard } from "./components/password-card";
import { ProfileCard } from "./components/profile-card";
import { SessionsCard } from "./components/sessions-card";
import { TwoFactorCard } from "./components/two-factor/two-factor-card";

const THEMES: { value: ThemeChoice; label: string; hint: string; icon: typeof Sun }[] = [
  { value: "system", label: "Automático", hint: "Segue o aparelho", icon: Monitor },
  { value: "light", label: "Claro", hint: "Bom sob o sol", icon: Sun },
  { value: "dark", label: "Escuro", hint: "Descansa a vista", icon: Moon },
];

/** A titled group of cards ("Perfil", "Segurança", "Preferências"). */
function Section({ id, title, description, children }: { id: string; title: string; description: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4">
      <div>
        <h2 id={id} className="text-base font-semibold">
          {title}
        </h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

/** A tiny panel drawn in light or dark colors (fixed, not following the theme). */
function MiniPanel({ dark }: { dark: boolean }) {
  return (
    <div className={cn("flex size-full gap-1.5 p-2", dark ? "bg-neutral-900" : "bg-white")}>
      <div className={cn("w-1/4 flex flex-col gap-1 rounded-sm p-1", dark ? "bg-neutral-800" : "bg-neutral-100")}>
        <div className="h-1.5 w-3/4 rounded-full bg-[#c46014]" />
        <div className={cn("h-1.5 rounded-full", dark ? "bg-neutral-700" : "bg-neutral-300")} />
        <div className={cn("h-1.5 w-2/3 rounded-full", dark ? "bg-neutral-700" : "bg-neutral-300")} />
      </div>
      <div className="flex-1 flex flex-col gap-1.5">
        <div className={cn("h-2 w-1/2 rounded-full", dark ? "bg-neutral-600" : "bg-neutral-300")} />
        <div className={cn("h-6 rounded-sm", dark ? "bg-neutral-800" : "bg-neutral-100")} />
        <div className="flex gap-1">
          <div className={cn("h-4 flex-1 rounded-sm", dark ? "bg-neutral-800" : "bg-neutral-100")} />
          <div className="h-4 w-1/4 rounded-sm bg-[#c46014]/80" />
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const hydrated = useHydrated();
  const { user } = useSession();
  const { choice, change, originOfEvent } = useThemeTransition();

  return (
    <div className="mx-auto max-w-3xl flex flex-col gap-6 p-4 md:p-6">
      <PageHeader title="Configurações" description="Sua conta, as preferências deste aparelho e a segurança." />

      {user && (
        <Section id="settings-account" title="Conta" description="Seus dados no painel.">
          <ProfileCard user={user} />
        </Section>
      )}

      <Section
        id="notificacoes"
        title="Notificações"
        description="Este aparelho, o que chega por push e e-mail, lojas silenciadas e o resumo diário."
      >
        <NotificationPreferencesCard />
      </Section>

      <Section id="settings-preferences" title="Preferências" description="Valem só para este aparelho.">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="size-4 text-primary" /> Aparência
          </CardTitle>
          <CardDescription>O tema vale para este aparelho.</CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            aria-label="Tema"
            value={hydrated ? choice : null}
            onValueChange={(value, details) => change(value as ThemeChoice, originOfEvent(details.event))}
            className="grid-cols-3 gap-3"
          >
            {THEMES.map((theme) => {
              const selected = hydrated && choice === theme.value;
              return (
                <Radio.Root
                  key={theme.value}
                  value={theme.value}
                  className={cn(
                    "group overflow-hidden rounded-xl border-2 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    selected ? "border-primary" : "border-border hover:border-primary/40"
                  )}
                >
                  <div className="relative aspect-[4/3] overflow-hidden border-b">
                    {theme.value === "system" ? (
                      <div className="flex h-full">
                        <div className="h-full w-1/2 overflow-hidden"><div className="h-full w-[200%]"><MiniPanel dark={false} /></div></div>
                        <div className="h-full w-1/2 overflow-hidden"><div className="-ml-[100%] h-full w-[200%]"><MiniPanel dark /></div></div>
                      </div>
                    ) : (
                      <MiniPanel dark={theme.value === "dark"} />
                    )}
                    {selected && (
                      <span className="absolute top-1.5 right-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow">
                        <Check className="size-3" />
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 p-2.5">
                    <theme.icon className="size-4 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{theme.label}</p>
                      <p className="truncate text-xs text-muted-foreground max-sm:hidden">{theme.hint}</p>
                    </div>
                  </div>
                </Radio.Root>
              );
            })}
          </RadioGroup>
        </CardContent>
      </Card>


      </Section>

      {user && (
        <Section id="settings-security" title="Segurança" description="Como você entra, sua senha e os aparelhos com a conta aberta.">
          <TwoFactorCard />
          <PasswordCard />
          <SessionsCard />
        </Section>
      )}

      <div className="flex items-center justify-between gap-3 border-t pt-4">
        <p className="text-xs text-muted-foreground">Versão {env.NEXT_PUBLIC_BUILD_VERSION || "dev"}</p>
        <Button variant="outline" onClick={() => redirectToLogout(router)}>
          <LogOut /> Sair
        </Button>
      </div>
    </div>
  );
}
