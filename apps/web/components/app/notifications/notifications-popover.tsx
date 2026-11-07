"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDistanceToNowStrict, isToday, isYesterday, parseISO, differenceInCalendarDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AnimatePresence, motion } from "motion/react";
import {
  Bell,
  BellOff,
  BellRing,
  Check,
  CheckCheck,
  Megaphone,
  MoreHorizontal,
  RotateCw,
  Settings2,
  ShoppingBag,
  Store as StoreIcon,
  Trash2,
  type LucideIcon,
} from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertDialogDestructive } from "@/components/app/alert-dialog-destructive";
import { useNotification } from "@/contexts/notification-provider";
import { useNotificationsRealtime } from "@/hooks/use-notifications-realtime";
import { useAppSelector } from "@/redux/hooks";
import {
  useClearNotificationsMutation,
  useDeleteNotificationMutation,
  useGetNotificationsQuery,
  useMarkAllNotificationsAsReadMutation,
  useMarkNotificationAsReadMutation,
} from "@/redux/features/notification/notificationApi";
import type { AppNotification, NotificationCategory } from "@/types/notification";
import { cn } from "@/lib/utils";

type Filter = "all" | "unread" | NotificationCategory;

/** Each category's icon and tile colors (status tokens, both themes). */
const categories: Record<NotificationCategory, { label: string; icon: LucideIcon; tile: string }> = {
  order: { label: "Pedidos", icon: ShoppingBag, tile: "bg-primary/10 text-primary" },
  store: { label: "Lojas", icon: StoreIcon, tile: "bg-success/10 text-success" },
  system: { label: "Sistema", icon: Megaphone, tile: "bg-warning/10 text-warning" },
};

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "unread", label: "Não lidas" },
  { value: "order", label: "Pedidos" },
  { value: "store", label: "Lojas" },
  { value: "system", label: "Sistema" },
];

/** "Hoje", "Ontem", "Esta semana", "Antes": the list's day groups. */
function dayGroup(iso: string) {
  const date = parseISO(iso);
  if (isToday(date)) return "Hoje";
  if (isYesterday(date)) return "Ontem";
  return differenceInCalendarDays(new Date(), date) < 7 ? "Esta semana" : "Antes";
}

/** "agora", "5 min", "3 h", "2 d" (the list is tight). */
function shortAgo(iso: string) {
  const date = parseISO(iso);
  if (Date.now() - date.getTime() < 60_000) return "agora";
  return formatDistanceToNowStrict(date, { locale: ptBR })
    .replace(/ minutos?/, " min")
    .replace(/ horas?/, " h")
    .replace(/ dias?/, " d")
    .replace(/ meses?/, " m")
    .replace(/ anos?/, " a");
}

export function NotificationsPopover() {
  const userId = useAppSelector((state) => state.auth.user?.id);
  useNotificationsRealtime(userId);

  const { data, isLoading, isError, refetch } = useGetNotificationsQuery();
  const [markAllAsRead] = useMarkAllNotificationsAsReadMutation();
  const [clearAll, { isLoading: isClearing }] = useClearNotificationsMutation();

  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [confirmClear, setConfirmClear] = useState(false);

  const notifications = data?.data ?? [];
  const unreadCount = data?.meta.unreadCount ?? 0;
  const visible = notifications.filter((notification) =>
    filter === "all" ? true : filter === "unread" ? !notification.readAt : notification.category === filter
  );
  // Day groups in list order.
  const groups: { label: string; items: AppNotification[] }[] = [];
  for (const notification of visible) {
    const label = dayGroup(notification.createdAt);
    const last = groups.at(-1);
    if (last?.label === label) last.items.push(notification);
    else groups.push({ label, items: [notification] });
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <Tooltip>
          <TooltipTrigger
            render={
              <PopoverTrigger
                render={
                  <Button
                    size="icon"
                    variant="ghost"
                    className="relative rounded-full text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
                    aria-label={
                      unreadCount > 0 ? `Notificações (${unreadCount} não ${unreadCount === 1 ? "lida" : "lidas"})` : "Notificações"
                    }
                  />
                }
              />
            }
          >
            <Bell className="size-4.5" />
            <AnimatePresence>
              {unreadCount > 0 && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.6 }}
                  className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary-foreground px-1 text-[10px] font-bold text-primary tabular-nums ring-2 ring-primary"
                  aria-hidden
                >
                  {unreadCount > 9 ? "9+" : unreadCount}
                </motion.span>
              )}
            </AnimatePresence>
          </TooltipTrigger>
          <TooltipContent side="bottom">Notificações</TooltipContent>
        </Tooltip>

        <PopoverContent align="end" initialFocus={false} className="w-[min(400px,calc(100vw-1.5rem))] gap-0 overflow-hidden p-0">
          <header className="flex items-center gap-2 border-b px-4 py-3">
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-semibold">Notificações</h3>
              <p className="text-xs text-muted-foreground">
                {unreadCount > 0
                  ? `${unreadCount} não ${unreadCount === 1 ? "lida" : "lidas"}`
                  : notifications.length > 0
                    ? "Tudo em dia"
                    : "Os avisos da sua equipe e das lojas"}
              </p>
            </div>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Marcar todas como lidas"
                    disabled={unreadCount === 0}
                    onClick={() => markAllAsRead()}
                  />
                }
              >
                <CheckCheck />
              </TooltipTrigger>
              <TooltipContent side="bottom">Marcar todas como lidas</TooltipContent>
            </Tooltip>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button size="icon-sm" variant="ghost" aria-label="Mais opções de notificações" />}>
                <MoreHorizontal />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  render={<Link href="/app/settings#notificacoes" onClick={() => setOpen(false)} />}
                >
                  <Settings2 /> Preferências de notificação
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  disabled={notifications.length === 0}
                  onClick={() => setConfirmClear(true)}
                >
                  <Trash2 /> Limpar todas
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </header>

          <div className="border-b px-3 py-2">
            <ToggleGroup
              aria-label="Filtrar notificações"
              value={[filter]}
              onValueChange={(value) => value[0] && setFilter(value[0] as Filter)}
              className="flex w-full gap-1 overflow-x-auto [scrollbar-width:none]"
            >
              {FILTERS.map((option) => (
                <ToggleGroupItem
                  key={option.value}
                  value={option.value}
                  size="sm"
                  className="h-7 shrink-0 rounded-full px-3 text-xs data-[pressed]:bg-primary data-[pressed]:text-primary-foreground"
                >
                  {option.label}
                  {option.value === "unread" && unreadCount > 0 && (
                    <span className="ml-1 tabular-nums opacity-80">{unreadCount}</span>
                  )}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          {isLoading ? (
            <NotificationSkeleton />
          ) : isError ? (
            <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
              <p className="text-sm text-muted-foreground">Não foi possível carregar as notificações.</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RotateCw /> Tentar novamente
              </Button>
            </div>
          ) : visible.length > 0 ? (
            <ScrollArea className="max-h-[min(26rem,60svh)]">
              <div className="pb-2">
                {groups.map((group) => (
                  <section key={group.label} aria-label={group.label}>
                    <h4 className="sticky top-0 z-10 bg-popover/95 px-4 pt-3 pb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase backdrop-blur">
                      {group.label}
                    </h4>
                    <ul className="flex flex-col px-2">
                      <AnimatePresence initial={false}>
                        {group.items.map((notification) => (
                          <NotificationItem
                            key={notification.id}
                            notification={notification}
                            onNavigate={() => setOpen(false)}
                          />
                        ))}
                      </AnimatePresence>
                    </ul>
                  </section>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <EmptyState filter={filter} />
          )}

          <PushFooter />
        </PopoverContent>
      </Popover>

      <AlertDialogDestructive
        open={confirmClear}
        onOpenChange={setConfirmClear}
        loading={isClearing}
        title="Limpar notificações"
        description="Todas as suas notificações serão excluídas. Esta ação não pode ser desfeita."
        confirmLabel="Limpar"
        onConfirm={async () => {
          await clearAll();
          setConfirmClear(false);
        }}
      />
    </>
  );
}

function NotificationItem({ notification, onNavigate }: { notification: AppNotification; onNavigate: () => void }) {
  const router = useRouter();
  const [markAsRead] = useMarkNotificationAsReadMutation();
  const [remove] = useDeleteNotificationMutation();

  const unread = !notification.readAt;
  const category = categories[notification.category] ?? categories.system;
  const Icon = category.icon;

  const handleOpen = () => {
    if (unread) markAsRead(notification.id);
    if (notification.url) {
      onNavigate();
      router.push(notification.url);
    }
  };

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.18 }}
      className="group/notification relative rounded-xl transition-colors hover:bg-muted/60 has-focus-visible:bg-muted/60"
    >
      {unread && <span aria-hidden className="absolute top-3 bottom-3 left-0 w-0.5 rounded-full bg-primary" />}
      <button
        type="button"
        onClick={handleOpen}
        className="flex w-full items-start gap-3 rounded-xl p-2.5 pr-20 text-left outline-none"
      >
        <span className={cn("mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl", category.tile)}>
          <Icon className="size-4" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className={cn("text-sm leading-snug text-pretty", unread ? "font-semibold" : "font-medium text-foreground/90")}>
            {notification.title}
            {unread && <span className="sr-only"> (não lida)</span>}
          </span>
          <span className="line-clamp-2 text-xs text-muted-foreground">{notification.body}</span>
        </span>
      </button>
      <div className="absolute top-2.5 right-2 flex items-center gap-0.5">
        <time
          dateTime={notification.createdAt}
          className="px-1 text-[11px] text-muted-foreground tabular-nums transition-opacity group-focus-within/notification:opacity-0 group-hover/notification:opacity-0 [@media(hover:none)]:hidden"
          title={parseISO(notification.createdAt).toLocaleString("pt-BR")}
        >
          {shortAgo(notification.createdAt)}
        </time>
        <span className="absolute right-0 flex items-center gap-0.5 opacity-0 transition-opacity group-focus-within/notification:opacity-100 group-hover/notification:opacity-100 [@media(hover:none)]:static [@media(hover:none)]:opacity-100">
          {unread && (
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Marcar como lida"
              onClick={() => markAsRead(notification.id)}
            >
              <Check />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-xs"
            className="hover:text-destructive"
            aria-label="Excluir notificação"
            onClick={() => remove(notification.id)}
          >
            <Trash2 />
          </Button>
        </span>
      </div>
    </motion.li>
  );
}

function EmptyState({ filter }: { filter: Filter }) {
  const unread = filter === "unread";
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="relative mb-4">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-muted">
          {unread ? <CheckCheck className="size-6 text-success" /> : <Bell className="size-6 text-muted-foreground" />}
        </div>
      </div>
      <h4 className="mb-1 text-sm font-semibold">{unread ? "Tudo em dia" : "Nenhuma notificação"}</h4>
      <p className="max-w-64 text-xs text-muted-foreground">
        {unread
          ? "Você já viu todas as notificações."
          : "Novos pedidos e avisos das suas lojas aparecem aqui assim que chegarem."}
      </p>
    </div>
  );
}

/** This device's push, at hand; the rest in Configurações > Notificações. */
function PushFooter() {
  const { isSupported, isSubscribed, subscribe, unsubscribe, loading, error } = useNotification();
  return (
    <footer className="flex flex-col gap-1 border-t bg-muted/30 px-4 py-2.5">
      <label className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-xs">
          {isSubscribed ? <BellRing className="size-3.5 text-primary" /> : <BellOff className="size-3.5 text-muted-foreground" />}
          <span>
            <span className="font-medium">Push neste aparelho</span>
            <Link
              href="/app/settings#notificacoes"
              className={cn(buttonVariants({ variant: "link", size: "xs" }), "ml-1 h-auto p-0 text-xs")}
            >
              Preferências
            </Link>
          </span>
        </span>
        <Switch
          size="sm"
          checked={isSubscribed}
          disabled={!isSupported || loading}
          onCheckedChange={(checked) => void (checked ? subscribe() : unsubscribe())}
          aria-label="Notificações push neste aparelho"
        />
      </label>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </footer>
  );
}

function NotificationSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-4" aria-busy>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-start gap-3">
          <Skeleton className="size-9 rounded-xl" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-3 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
