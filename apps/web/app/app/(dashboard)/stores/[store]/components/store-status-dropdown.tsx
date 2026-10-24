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
              "h-auto py-1 text-white",
              maintenance
                ? "bg-yellow-600 hover:bg-yellow-700"
                : store.isOpen
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-red-600 hover:bg-red-700"
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
              <CalendarClock className="size-4 shrink-0 text-green-600" />
              Seguir o horário
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => set("closed")}>
              <XCircle className="size-4 shrink-0 text-red-600" />
              Fechar agora (reabre no próximo horário)
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <DropdownMenuItem onClick={() => set("open")}>
              <CheckCircle className="size-4 shrink-0 text-green-600" />
              Aberto
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => set("closed")}>
              <XCircle className="size-4 shrink-0 text-red-600" />
              Fechado
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuItem onClick={() => set("maintenance")}>
          <Wrench className="size-4 shrink-0 text-yellow-600" />
          Em Manutenção
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
