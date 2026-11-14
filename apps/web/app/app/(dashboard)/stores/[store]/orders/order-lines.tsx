import type { Order } from "@react-menu/contracts";
import { addonLabels } from "@/lib/addon-label";
import { lineName } from "@/lib/order-line";
import { cn } from "@/lib/utils";

/** An order's lines as the counter reads them: quantity, name, add-ons and notes (no prices). */
export function OrderLines({ items, className }: { items: Order["items"]; className?: string }) {
  return (
    <ul className={cn("flex flex-col gap-1 text-sm", className)}>
      {items.map((line) => (
        <li key={line.id}>
          <span className="font-semibold tabular-nums">{line.quantity}×</span> {lineName(line)}
          {line.addons.length > 0 && (
            <span className="text-muted-foreground"> + {addonLabels(line.addons).join(", ")}</span>
          )}
          {line.notes && <span className="block text-xs font-medium text-warning">“{line.notes}”</span>}
        </li>
      ))}
    </ul>
  );
}
