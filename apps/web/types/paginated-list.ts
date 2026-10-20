import type { Meta } from "@/types/request";

export type PaginatedList<T> = {
  data: T[];
  meta: Meta;
};

export function getMetaTotal(meta: Meta | undefined): number {
  if (!meta) return 0;
  const rec = meta as unknown as Record<string, unknown>;
  const t = rec.total;
  return typeof t === "number" && Number.isFinite(t) ? t : 0;
}
