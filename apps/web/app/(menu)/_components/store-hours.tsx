"use client";

import { useState } from "react";
import { CalendarClock } from "lucide-react";
import type { PublicMenu } from "@react-menu/contracts";
import { ResponsiveModal } from "@/components/app/responsive-modal";
import { useHydrated } from "@/hooks/use-hydrated";
import { BUSINESS_TIMEZONE, DAY_NAMES, WEEK_ORDER, formatWhen } from "@/lib/opening-hours";
import { cn } from "@/lib/utils";

/** Today in the store's timezone (0 = Sunday). */
const todayIndex = () =>
  ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
    new Intl.DateTimeFormat("en-US", { timeZone: BUSINESS_TIMEZONE, weekday: "short" }).format(new Date())
  );

/**
 * "Horários" chip in the store hero: opens the week (today highlighted)
 * with the current status on top. Only for stores on a schedule.
 */
export function StoreHours({ store }: { store: PublicMenu["store"] }) {
  const [open, setOpen] = useState(false);
  const hydrated = useHydrated();
  const hours = store.openingHours;
  if (!hours) return null;
  const today = hydrated ? todayIndex() : -1;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors hover:bg-muted"
      >
        <CalendarClock className="size-3.5 text-primary" /> Horários
      </button>
      <ResponsiveModal open={open} onOpenChange={setOpen} title="Horário de funcionamento" className="sm:max-w-sm">
        <div className="space-y-4 p-4 pt-0 sm:pt-4">
          <div
            className={cn(
              "flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium",
              store.isOpen
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                : "bg-muted text-muted-foreground"
            )}
          >
            <span className={cn("size-2 rounded-full", store.isOpen ? "bg-emerald-500" : "bg-muted-foreground")} />
            <span suppressHydrationWarning>
              {store.isOpen
                ? `Aberto agora${store.closesAt ? ` · fecha ${formatWhen(store.closesAt)}` : ""}`
                : `Fechado agora${store.opensAt ? ` · abre ${formatWhen(store.opensAt)}` : ""}`}
            </span>
          </div>
          <ul aria-label="Horários da semana" className="space-y-1">
            {WEEK_ORDER.map((day) => {
              const intervals = hours
                .filter((interval) => interval.day === day)
                .sort((a, b) => a.opens.localeCompare(b.opens));
              const isToday = day === today;
              return (
                <li
                  key={day}
                  aria-current={isToday ? "date" : undefined}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm",
                    isToday && "bg-primary/10 font-medium"
                  )}
                >
                  <span className="flex items-center gap-2">
                    {DAY_NAMES[day]}
                    {isToday && (
                      <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground uppercase">
                        Hoje
                      </span>
                    )}
                  </span>
                  {intervals.length ? (
                    <span className="flex flex-wrap justify-end gap-1">
                      {intervals.map((interval) => (
                        <span key={interval.opens} className="rounded-md bg-muted px-2 py-0.5 text-xs tabular-nums">
                          {interval.opens === "00:00" && interval.closes === "23:59"
                            ? "24 horas"
                            : `${interval.opens} – ${interval.closes}`}
                        </span>
                      ))}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Fechado</span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </ResponsiveModal>
    </>
  );
}
