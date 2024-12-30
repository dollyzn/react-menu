import React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface StatusButtonProps {
  status: "open" | "closed" | "maintenance";
}

const StatusButton = React.forwardRef<HTMLButtonElement, StatusButtonProps>(
  ({ status, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        className={cn(
          "h-auto py-1 text-white",
          status === "open" && "bg-green-600 hover:bg-green-700",
          status === "closed" && "bg-red-600 hover:bg-red-700",
          status === "maintenance" && "bg-yellow-600 hover:bg-yellow-700"
        )}
        size="sm"
        {...props} // Pass all other props to the Button
      >
        {status === "open" && "Aberto"}
        {status === "closed" && "Fechado"}
        {status === "maintenance" && "Em Manutenção"}
      </Button>
    );
  }
);

StatusButton.displayName = "StatusButton";

export default StatusButton;
