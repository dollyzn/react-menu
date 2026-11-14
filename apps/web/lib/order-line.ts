import type { OrderItem } from "@react-menu/contracts";

/**
 * A line's name on the staff screens: "Pastel de Frango com Catupiry" when a
 * choice renames the item (the API's `displayName`), else the item's name.
 */
export const lineName = (line: Pick<OrderItem, "name" | "displayName">) => line.displayName ?? line.name;
