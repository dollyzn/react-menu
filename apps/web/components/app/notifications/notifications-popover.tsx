"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeft,
  Bell,
  Check,
  Megaphone,
  MoreHorizontal,
  RotateCw,
  Settings,
  ShoppingBag,
  Store as StoreIcon,
  Trash2,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
import type {
  AppNotification,
  NotificationCategory,
} from "@/types/notification";
import { cn } from "@/lib/utils";

type Tab = "all" | NotificationCategory;

const categories: Record<NotificationCategory, { label: string; icon: LucideIcon }> = {
  order: { label: "Pedidos", icon: ShoppingBag },
  store: { label: "Lojas", icon: StoreIcon },
  system: { label: "Sistema", icon: Megaphone },
};

export function NotificationsPopover() {
  const userId = useAppSelector((state) => state.auth.user?.id);
  useNotificationsRealtime(userId);

  const { data, isLoading, isError, refetch } = useGetNotificationsQuery();
  const [markAllAsRead] = useMarkAllNotificationsAsReadMutation();
  const [clearAll, { isLoading: isClearing }] = useClearNotificationsMutation();

  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("all");
  const [showSettings, setShowSettings] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const notifications = data?.data ?? [];
  const unreadCount = data?.meta.unreadCount ?? 0;
  const visible =
    tab === "all"
      ? notifications
      : notifications.filter((n) => n.category === tab);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setShowSettings(false);
  };

  return (
    <>
      <Popover open={open} onOpenChange={handleOpenChange}>
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
                      unreadCount > 0
                        ? `Notificações (${unreadCount} não lidas)`
                        : "Notificações"
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
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="absolute top-0.5 right-0.5 flex size-2.5"
                  aria-hidden
                >
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary-foreground opacity-75" />
                  <span className="relative inline-flex size-2.5 rounded-full bg-primary-foreground ring-2 ring-primary" />
                </motion.span>
              )}
            </AnimatePresence>
          </TooltipTrigger>
          <TooltipContent side="bottom">Notificações</TooltipContent>
        </Tooltip>

        <PopoverContent
          align="end"
          initialFocus={false}
          className="w-[min(380px,calc(100vw-2rem))] gap-0 p-0"
        >
          {showSettings ? (
            <NotificationSettings onBack={() => setShowSettings(false)} />
          ) : (
            <div className="flex flex-col">
              <div className="flex items-center justify-between border-b p-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold">Notificações</h3>
                  {unreadCount > 0 && (
                    <Badge variant="secondary">
                      {unreadCount} não {unreadCount === 1 ? "lida" : "lidas"}
                    </Badge>
                  )}
                </div>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label="Configurações de notificação"
                        onClick={() => setShowSettings(true)}
                      />
                    }
                  >
                    <Settings />
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Configurações</TooltipContent>
                </Tooltip>
              </div>

              <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)}>
                <div className="px-4 pt-3">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="all">Todas</TabsTrigger>
                    <TabsTrigger value="order">
                      {categories.order.label}
                    </TabsTrigger>
                    <TabsTrigger value="store">{categories.store.label}</TabsTrigger>
                    <TabsTrigger value="system">{categories.system.label}</TabsTrigger>
                  </TabsList>
                </div>

              <TabsContent value={tab}>

              {notifications.length > 0 && (
                <div className="flex items-center justify-between px-2 pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={unreadCount === 0}
                    onClick={() => markAllAsRead()}
                  >
                    <Check /> Marcar todas como lidas
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmClear(true)}
                  >
                    <Trash2 /> Limpar todas
                  </Button>
                </div>
              )}

              {isLoading ? (
                <NotificationSkeleton />
              ) : isError ? (
                <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
                  <p className="text-sm text-muted-foreground">
                    Não foi possível carregar as notificações.
                  </p>
                  <Button variant="outline" size="sm" onClick={() => refetch()}>
                    <RotateCw /> Tentar novamente
                  </Button>
                </div>
              ) : visible.length > 0 ? (
                <ScrollArea className="h-80">
                  <ul className="flex flex-col py-2">
                    {visible.map((notification) => (
                      <NotificationItem
                        key={notification.id}
                        notification={notification}
                        onNavigate={() => handleOpenChange(false)}
                      />
                    ))}
                  </ul>
                </ScrollArea>
              ) : (
                <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
                  <div className="mb-4 rounded-full bg-muted p-3">
                    <Bell className="size-6 text-muted-foreground" />
                  </div>
                  <h4 className="mb-1 text-base font-medium">
                    Nenhuma notificação
                  </h4>
                  <p className="max-w-62.5 text-sm text-muted-foreground">
                    Você não tem notificações no momento. Elas aparecerão aqui
                    quando chegarem.
                  </p>
                </div>
              )}
              </TabsContent>
              </Tabs>
            </div>
          )}
        </PopoverContent>
      </Popover>

      <AlertDialogDestructive
        open={confirmClear}
        onOpenChange={setConfirmClear}
        loading={isClearing}
        title="Limpar notificações"
        description="Todas as suas notificações serão excluídas. Esta ação não pode ser desfeita."
        onConfirm={async () => {
          await clearAll();
          setConfirmClear(false);
        }}
      />
    </>
  );
}

function NotificationItem({
  notification,
  onNavigate,
}: {
  notification: AppNotification;
  onNavigate: () => void;
}) {
  const router = useRouter();
  const [markAsRead] = useMarkNotificationAsReadMutation();
  const [remove] = useDeleteNotificationMutation();

  const unread = !notification.readAt;
  const Icon = categories[notification.category]?.icon ?? Bell;

  const handleOpen = () => {
    if (unread) markAsRead(notification.id);
    if (notification.url) {
      onNavigate();
      router.push(notification.url);
    }
  };

  return (
    <li
      className={cn(
        "group/notification relative flex items-start gap-1 px-2 transition-colors hover:bg-muted/50",
        unread && "bg-muted/30"
      )}
    >
      <button
        type="button"
        onClick={handleOpen}
        className="flex flex-1 items-start gap-3 rounded-md p-2 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon className="size-4" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex items-center gap-2">
            <span className={cn("text-sm", unread ? "font-semibold" : "font-medium")}>
              {notification.title}
            </span>
            {unread && (
              <span className="size-2 shrink-0 rounded-full bg-primary">
                <span className="sr-only">Não lida</span>
              </span>
            )}
          </span>
          <span className="text-xs text-muted-foreground">{notification.body}</span>
          <time
            dateTime={notification.createdAt}
            className="text-xs text-muted-foreground"
          >
            {formatDistanceToNow(parseISO(notification.createdAt), {
              addSuffix: true,
              locale: ptBR,
            })}
          </time>
        </span>
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              className="mt-2"
              aria-label="Ações da notificação"
            />
          }
        >
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {unread && (
            <DropdownMenuItem onClick={() => markAsRead(notification.id)}>
              <Check /> Marcar como lida
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            variant="destructive"
            onClick={() => remove(notification.id)}
          >
            <Trash2 /> Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

function NotificationSettings({ onBack }: { onBack: () => void }) {
  const { isSupported, isSubscribed, subscribe, unsubscribe, loading, error } =
    useNotification();

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 border-b p-4">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Voltar para notificações"
          onClick={onBack}
        >
          <ArrowLeft />
        </Button>
        <h3 className="text-base font-semibold">Configurações</h3>
      </div>

      <div className="flex flex-col gap-4 p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <Label htmlFor="push-notifications">Notificações push</Label>
            <p className="text-xs text-muted-foreground">
              Receba notificações neste dispositivo mesmo com o sistema fechado.
            </p>
          </div>
          <Switch
            id="push-notifications"
            checked={isSubscribed}
            disabled={!isSupported || loading}
            onCheckedChange={(checked) =>
              checked ? subscribe() : unsubscribe()
            }
          />
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </div>
  );
}

function NotificationSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-4" aria-busy>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-start gap-3">
          <Skeleton className="size-8 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-1/4" />
          </div>
        </div>
      ))}
    </div>
  );
}
