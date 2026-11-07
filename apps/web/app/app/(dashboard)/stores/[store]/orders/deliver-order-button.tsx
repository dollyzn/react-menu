"use client";

import { useState } from "react";
import { CircleCheck, PackageCheck } from "lucide-react";
import { toast } from "sonner";
import type { Order } from "@react-menu/contracts";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useCompleteOrderMutation } from "@/redux/features/order/orderApi";

/**
 * "Entregar". Items that skip the kitchen (drinks, ready-made products) never
 * show up there, so the counter is reminded of them before the order leaves.
 */
export function DeliverOrderButton({
  order,
  storeId,
  className,
}: {
  order: Order;
  storeId: string;
  className?: string;
}) {
  const [complete, { isLoading }] = useCompleteOrderMutation();
  const [confirming, setConfirming] = useState(false);
  const extras = order.items.filter((line) => !line.requiresPreparation);

  const deliver = async () => {
    await complete({ storeId, orderId: order.id }).unwrap();
    setConfirming(false);
    toast.success(`Pedido #${order.number} entregue`);
  };

  return (
    <>
      <Button
        className={className}
        loading={isLoading && !confirming}
        onClick={() => (extras.length > 0 ? setConfirming(true) : void deliver())}
      >
        <CircleCheck /> Entregar
      </Button>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-primary/10 text-primary">
              <PackageCheck />
            </AlertDialogMedia>
            <AlertDialogTitle>Separou tudo do pedido #{order.number}?</AlertDialogTitle>
            <AlertDialogDescription>
              {extras.length === 1 ? "Este item não passa pela cozinha" : "Estes itens não passam pela cozinha"}:
              confira se {extras.length === 1 ? "ele vai" : "eles vão"} junto.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <ul className="flex flex-col gap-1.5 rounded-xl bg-muted/60 p-3 text-sm" aria-label="Itens sem preparo">
            {extras.map((line) => (
              <li key={line.id} className="flex items-baseline gap-2">
                <span className="font-semibold tabular-nums">{line.quantity}×</span>
                <span className="flex-1">{line.name}</span>
              </li>
            ))}
          </ul>
          <AlertDialogFooter>
            <AlertDialogCancel variant="outline" disabled={isLoading}>
              Voltar
            </AlertDialogCancel>
            <AlertDialogAction onClick={deliver} loading={isLoading}>
              Sim, entregar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
