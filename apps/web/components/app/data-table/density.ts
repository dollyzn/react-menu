import type { DensityOption } from ".";

type CellButtonSize = "xs" | "sm" | "default" | "lg";

const CELL_BUTTON_SIZE: Record<DensityOption, CellButtonSize> = {
  spacious: "lg",
  comfortable: "default",
  default: "default",
  compact: "sm",
  "ultra-compact": "xs",
};

/**
 * Size for buttons inside table cells (e.g. "6 Itens"), following the row
 * density the user picked. Cells read it from `table.options.meta.density`.
 */
export function cellButtonSize(density: DensityOption | undefined): CellButtonSize {
  return CELL_BUTTON_SIZE[density ?? "default"];
}
