"use client";

import { useUpdateStoreStatusMutation } from "@/redux/features/store/storeApi";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { CalendarClock, CheckCircle, Wrench, XCircle } from "lucide-react";
import { formatWhen } from "@/lib/opening-hours";
import { cn } from "@/lib/utils";

/**
 * Open / closed / maintenance. On a schedule, "Seguir o horário" lets it
 * open and close by itself and "Fechar agora" pauses it until the next
 * opening (it reopens by itself).
 */
export function StoreStatusDropdown({ store }: { store: Store }) {
  const [updateStatus] = useUpdateStoreStatusMutation();
  const set = (next: Store["status"]) => updateStatus({ id: store.id, status: next });

  const maintenance = store.status === "maintenance";
  const label = maintenance
    ? "Em Manutenção"
    : store.scheduleEnabled
      ? store.isOpen
        ? `Aberto${store.closesAt ? ` · até ${formatWhen(store.closesAt).replace(/^às /, "")}` : ""}`
        : `Fechado${store.opensAt ? ` · abre ${formatWhen(store.opensAt)}` : ""}`
      : store.isOpen
        ? "Aberto"
        : "Fechado";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label={`Status da loja: ${label}`}
            className={cn(
              "h-auto py-1",
              maintenance
                ? "bg-warning text-warning-foreground hover:bg-warning/90"
                : store.isOpen
                  ? "bg-success text-success-foreground hover:bg-success/90"
                  : "bg-destructive text-white hover:bg-destructive/90"
            )}
            size="sm"
          />
        }
      >
        {store.scheduleEnabled && !maintenance && <CalendarClock />}
        {label}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-48">
        {store.scheduleEnabled ? (
          <>
            <DropdownMenuItem onClick={() => set("open")}>
              <CalendarClock className="size-4 shrink-0 text-success" />
              Seguir o horário
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => set("closed")}>
              <XCircle className="size-4 shrink-0 text-destructive" />
              Fechar agora (reabre no próximo horário)
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <DropdownMenuItem onClick={() => set("open")}>
              <CheckCircle className="size-4 shrink-0 text-success" />
              Aberto
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => set("closed")}>
              <XCircle className="size-4 shrink-0 text-destructive" />
              Fechado
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuItem onClick={() => set("maintenance")}>
          <Wrench className="size-4 shrink-0 text-warning" />
          Em Manutenção
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
