"use client";

import { Bell, BellOff, BellRing, Mail, Megaphone, RotateCw, ShoppingBag, Smartphone, Store as StoreIcon, Sunrise } from "lucide-react";
import type { NotificationCategory, NotificationPreferences, NotificationPreferencesInput } from "@react-menu/contracts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useNotification } from "@/contexts/notification-provider";
import {
  useGetNotificationPreferencesQuery,
  useUpdateNotificationPreferencesMutation,
} from "@/redux/features/account/accountApi";
import { cn } from "@/lib/utils";

const CATEGORIES: Record<NotificationCategory, { label: string; icon: typeof Bell }> = {
  order: { label: "Pedidos", icon: ShoppingBag },
  store: { label: "Lojas", icon: StoreIcon },
  system: { label: "Sistema", icon: Megaphone },
};

const HOURS = Array.from({ length: 24 }, (_, hour) => ({
  value: String(hour),
  label: `${String(hour).padStart(2, "0")}:00`,
}));

/** The whole choice, as the API takes it, from what's on screen. */
function toInput(preferences: NotificationPreferences): NotificationPreferencesInput {
  return {
    channels: Object.fromEntries(preferences.types.map((type) => [type.type, { push: type.push, email: type.email }])),
    mutedStoreIds: preferences.stores.filter((store) => store.muted).map((store) => store.id),
    dailySummary: { enabled: preferences.dailySummary.enabled, hour: preferences.dailySummary.hour },
  };
}

/**
 * Configurações > Notificações: this device's push, what arrives by push
 * and e-mail per type (the bell always shows everything), muted stores and
 * the daily summary. Every change saves at once.
 */
export function NotificationPreferencesCard() {
  const push = useNotification();
  const { data, isLoading, isError, refetch } = useGetNotificationPreferencesQuery();
  const [save] = useUpdateNotificationPreferencesMutation();

  const change = (edit: (input: NotificationPreferencesInput) => void) => {
    if (!data) return;
    const input = toInput(data);
    edit(input);
    void save(input);
  };

  const byCategory = (Object.keys(CATEGORIES) as NotificationCategory[])
    .map((category) => ({ category, types: data?.types.filter((type) => type.category === category) ?? [] }))
    .filter((group) => group.types.length > 0);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {push.isSubscribed ? <BellRing className="size-4 text-primary" /> : <BellOff className="size-4 text-muted-foreground" />}
            Este aparelho
          </CardTitle>
          <CardDescription>
            O push chega mesmo com o painel fechado. Ative em cada celular ou computador que você usa.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <label className="flex items-center justify-between gap-4 rounded-xl border p-3">
            <span className="flex items-center gap-3">
              <Smartphone className="size-4 shrink-0 text-muted-foreground" />
              <span>
                <span className="block text-sm font-medium">Notificações push neste aparelho</span>
                <span className="block text-xs text-muted-foreground">
                  {push.isSupported ? "Usa as notificações do navegador." : (push.error ?? "Indisponível neste navegador.")}
                </span>
              </span>
            </span>
            <Switch
              checked={push.isSubscribed}
              disabled={!push.isSupported || push.loading}
              onCheckedChange={(on) => void (on ? push.subscribe() : push.unsubscribe())}
              aria-label="Notificações push neste aparelho"
            />
          </label>
          {push.error && push.isSupported && <p className="text-xs text-destructive">{push.error}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="size-4 text-primary" /> O que você recebe
          </CardTitle>
          <CardDescription>
            Tudo aparece no sino do painel. Escolha o que também chega por push e por e-mail.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {isError && !data ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <p className="text-sm text-muted-foreground">Não foi possível carregar suas preferências.</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RotateCw /> Tentar novamente
              </Button>
            </div>
          ) : isLoading || !data ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            byCategory.map(({ category, types }) => {
              const { label, icon: Icon } = CATEGORIES[category];
              return (
                <section key={category} aria-label={label} className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-3 px-1 text-xs font-medium text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Icon className="size-3.5" /> {label}
                    </span>
                    <span className="flex w-28 justify-around" aria-hidden>
                      <span className="flex items-center gap-1"><Smartphone className="size-3" /> Push</span>
                      <span className="flex items-center gap-1"><Mail className="size-3" /> E-mail</span>
                    </span>
                  </div>
                  <ul className="divide-y rounded-xl border">
                    {types.map((type) => (
                      <li key={type.type} className="flex items-center gap-3 p-3">
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium">{type.label}</span>
                          <span className="block text-xs text-pretty text-muted-foreground">{type.description}</span>
                        </span>
                        <span className="flex w-28 shrink-0 justify-around">
                          <Switch
                            checked={type.push}
                            onCheckedChange={(on) => change((input) => (input.channels[type.type].push = on))}
                            aria-label={`${type.label}: push`}
                          />
                          <Switch
                            checked={type.email}
                            onCheckedChange={(on) => change((input) => (input.channels[type.type].email = on))}
                            aria-label={`${type.label}: e-mail`}
                          />
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })
          )}
        </CardContent>
      </Card>

      {data && data.stores.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <StoreIcon className="size-4 text-primary" /> Lojas
            </CardTitle>
            <CardDescription>
              Uma loja silenciada não manda push nem e-mail para você (continua no sino).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y rounded-xl border">
              {data.stores.map((store) => (
                <li key={store.id}>
                  <label className="flex items-center justify-between gap-4 p-3">
                    <span className={cn("text-sm font-medium", store.muted && "text-muted-foreground")}>
                      {store.name}
                      {store.muted && <span className="ml-2 text-xs font-normal">· silenciada</span>}
                    </span>
                    <Switch
                      checked={!store.muted}
                      onCheckedChange={(on) =>
                        change((input) => {
                          input.mutedStoreIds = on
                            ? input.mutedStoreIds.filter((id) => id !== store.id)
                            : [...input.mutedStoreIds, store.id];
                        })
                      }
                      aria-label={`Notificações da ${store.name}`}
                    />
                  </label>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {data?.dailySummary.available && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sunrise className="size-4 text-primary" /> Resumo diário
            </CardTitle>
            <CardDescription>
              Um e-mail por dia com as vendas, os pedidos, os mais vendidos e o estoque baixo de ontem, das
              lojas que você gerencia.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-4">
            <label className="flex items-center gap-3">
              <Switch
                checked={data.dailySummary.enabled}
                onCheckedChange={(on) => change((input) => (input.dailySummary.enabled = on))}
                aria-label="Resumo diário por e-mail"
              />
              <span className="text-sm font-medium">Receber o resumo por e-mail</span>
            </label>
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              às
              <Select
                items={HOURS}
                value={String(data.dailySummary.hour)}
                onValueChange={(value) => change((input) => (input.dailySummary.hour = Number(value)))}
                disabled={!data.dailySummary.enabled}
              >
                <SelectTrigger className="w-24" aria-label="Horário do resumo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HOURS.map((hour) => (
                    <SelectItem key={hour.value} value={hour.value}>
                      {hour.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </span>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
