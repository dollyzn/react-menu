"use client";

import { usePathname, useSearchParams } from "next/navigation";

/**
 * One query param as state: reading follows the URL, setting replaces it
 * without a navigation (Next keeps `useSearchParams` in sync). `null` clears it.
 */
export function useQueryParam(key: string) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const set = (value: string | null, extra?: (params: URLSearchParams) => void) => {
    const params = new URLSearchParams(window.location.search);
    if (value === null) params.delete(key);
    else params.set(key, value);
    extra?.(params);
    const query = params.toString();
    // null state: Next syncs useSearchParams only for app-made history entries.
    window.history.replaceState(null, "", query ? `${pathname}?${query}` : pathname);
  };
  return [searchParams.get(key), set] as const;
}
