import { useDispatch } from "react-redux";
import { AppDispatch } from "@/redux/store";
import { updateStatus } from "@/redux/slices/store";
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
  const dispatch = useDispatch<AppDispatch>();

  const handleUpdateStatus = (status: Store["status"]) => {
    dispatch(updateStatus({ id: storeId, status }));
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          className={cn(
            "h-auto py-1 text-white",
            status === "open" && "bg-green-600 hover:bg-green-700",
            status === "closed" && "bg-red-600 hover:bg-red-700",
            status === "maintenance" && "bg-yellow-600 hover:bg-yellow-700"
          )}
          size="sm"
        >
          {status === "open" && "Aberto"}
          {status === "closed" && "Fechado"}
          {status === "maintenance" && "Em Manutenção"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={() => handleUpdateStatus("open")}>
          <CheckCircle className="h-4 w-4 text-green-600" />
          Aberto
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleUpdateStatus("closed")}>
          <XCircle className="h-4 w-4 text-red-600" />
          Fechado
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleUpdateStatus("maintenance")}>
          <Wrench className="h-4 w-4 text-yellow-600" />
          Em Manutenção
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
