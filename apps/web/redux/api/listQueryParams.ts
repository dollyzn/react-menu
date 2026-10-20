export type StoreScopedListArg = {
  storeId: string;
  filters?: Record<string, string | string[] | undefined | null>;
  pagination?: { page?: number; pageSize?: number };
  sort?: string[];
};

/** Lista grande para selects / facetas (evita múltiplas requisições pequenas). */
export function storeListPrefetchArg(storeId: string): StoreScopedListArg {
  return { storeId, pagination: { page: 1, pageSize: 500 } };
}

/**
 * Monta URL com query string para listagens na API (Lucid: `page`, `perPage`, `sort`, filtros).
 * Arrays nos filtros viram chaves repetidas (`category_name=A&category_name=B`).
 */
export function buildStoreListUrl(
  storeId: string,
  resourcePath: string,
  input: Pick<StoreScopedListArg, "filters" | "pagination" | "sort">
) {
  const usp = new URLSearchParams();
  if (input.filters) {
    for (const [rawKey, val] of Object.entries(input.filters)) {
      if (val === undefined || val === null || val === "") continue;
      const key = rawKey === "category.name" ? "category_name" : rawKey;
      if (Array.isArray(val)) {
        for (const v of val) usp.append(key, String(v));
      } else {
        usp.append(key, String(val));
      }
    }
  }
  if (input.pagination?.page !== undefined) {
    usp.set("page", String(input.pagination.page));
  }
  if (input.pagination?.pageSize !== undefined) {
    usp.set("perPage", String(input.pagination.pageSize));
  }
  if (input.sort?.length) {
    for (const s of input.sort) {
      usp.append("sort", s);
    }
  }
  const base = `stores/${storeId}/${resourcePath}`;
  const q = usp.toString();
  return q ? `${base}?${q}` : base;
}
