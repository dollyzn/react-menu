"use client";

import { Bell, BellOff, Check, LogOut, Monitor, Moon, Palette, Sun, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import type { StoreRole } from "@react-menu/contracts";
import { PageHeader } from "@/components/app/layout/page-header";
import { Radio } from "@base-ui/react/radio";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { useSession } from "@/contexts/session-provider";
import { useNotification } from "@/contexts/notification-provider";
import { useHydrated } from "@/hooks/use-hydrated";
import { useThemeTransition, type ThemeChoice } from "@/hooks/use-theme-transition";
import { env } from "@/lib/env";
import { cn } from "@/lib/utils";
import { redirectToLogout } from "@/utils/navigation";

const THEMES: { value: ThemeChoice; label: string; hint: string; icon: typeof Sun }[] = [
  { value: "system", label: "Automático", hint: "Segue o aparelho", icon: Monitor },
  { value: "light", label: "Claro", hint: "Bom sob o sol", icon: Sun },
  { value: "dark", label: "Escuro", hint: "Descansa a vista", icon: Moon },
];

const ROLE_LABEL: Record<StoreRole, string> = { manager: "Gerente", attendant: "Atendente", kitchen: "Cozinha" };

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
  const push = useNotification();

  return (
    <div className="mx-auto max-w-3xl flex flex-col gap-6 p-4 md:p-6">
      <PageHeader title="Configurações" description="Sua conta e as preferências deste aparelho." />

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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {push.isSubscribed ? <Bell className="size-4 text-primary" /> : <BellOff className="size-4 text-muted-foreground" />}
            Notificações
          </CardTitle>
          <CardDescription>Avisos de novos pedidos e mudanças na loja, mesmo com o painel fechado.</CardDescription>
        </CardHeader>
        <CardContent>
          <label className="flex items-center justify-between gap-4 rounded-xl border p-3">
            <span>
              <span className="block text-sm font-medium">Notificações neste aparelho</span>
              <span className="block text-xs text-muted-foreground">
                {push.isSupported ? "Usa as notificações do navegador." : (push.error ?? "Indisponível neste navegador.")}
              </span>
            </span>
            <Switch
              checked={push.isSubscribed}
              disabled={!push.isSupported || push.loading}
              onCheckedChange={(on) => void (on ? push.subscribe() : push.unsubscribe())}
              aria-label="Notificações neste aparelho"
            />
          </label>
        </CardContent>
      </Card>

      {user && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserRound className="size-4 text-primary" /> Conta
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <Avatar className="size-12 border">
                <AvatarImage src={`https://api.dicebear.com/9.x/lorelei/svg?seed=${user.name ?? user.email}`} alt="" />
                <AvatarFallback>{(user.name ?? user.email).slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate font-semibold">{user.name}</p>
                <p className="truncate text-sm text-muted-foreground">{user.email}</p>
              </div>
              {user.superUser && (
                <span className="ml-auto rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">Administrador</span>
              )}
            </div>
            {user.stores.length > 0 && (
              <ul className="divide-y rounded-xl border text-sm">
                {user.stores.map((store) => (
                  <li key={store.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <span className="truncate">{store.name}</span>
                    <span className="text-muted-foreground">{ROLE_LABEL[store.role]}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">Versão {env.NEXT_PUBLIC_BUILD_VERSION || "dev"}</p>
              <Button variant="outline" onClick={() => redirectToLogout(router)}>
                <LogOut /> Sair
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
