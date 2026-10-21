"use client";

import { useUpdateStoreStatusMutation } from "@/redux/features/store/storeApi";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { CheckCircle, Wrench, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface StoreStatusDropdownProps {
  storeId: string;
  status: Store["status"];
}

export function StoreStatusDropdown({
  storeId,
  status,
}: StoreStatusDropdownProps) {
  const [updateStatus] = useUpdateStoreStatusMutation();

  const handleUpdateStatus = (next: Store["status"]) => {
    updateStatus({ id: storeId, status: next });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            className={cn(
              "h-auto py-1 text-white",
              status === "open" && "bg-green-600 hover:bg-green-700",
              status === "closed" && "bg-red-600 hover:bg-red-700",
              status === "maintenance" && "bg-yellow-600 hover:bg-yellow-700"
            )}
            size="sm"
          />
        }
      >
        {status === "open" && "Aberto"}
        {status === "closed" && "Fechado"}
        {status === "maintenance" && "Em Manutenção"}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-40">
        <DropdownMenuItem onClick={() => handleUpdateStatus("open")}>
          <CheckCircle className="size-4 shrink-0 text-green-600" />
          Aberto
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleUpdateStatus("closed")}>
          <XCircle className="size-4 shrink-0 text-red-600" />
          Fechado
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleUpdateStatus("maintenance")}>
          <Wrench className="size-4 shrink-0 text-yellow-600" />
          Em Manutenção
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
