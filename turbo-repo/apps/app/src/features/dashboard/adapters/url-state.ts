"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { UrlStateAdapter } from "@microboxlabs/miot-dashboard-ui";

/**
 * Seam B implementation: the package's `UrlStateAdapter` over the Next.js
 * app router. `subscribe` is a no-op by design — Next re-renders consumers on
 * URL changes, so the adapter instance (rebuilt via useMemo) is the signal.
 */
export function useNextUrlStateAdapter(): UrlStateAdapter {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  return useMemo<UrlStateAdapter>(
    () => ({
      get: (key) => searchParams.get(key),
      getAll: () => Object.fromEntries(searchParams.entries()),
      pathname: () => pathname,
      set: (params, options) => {
        const next = new URLSearchParams(searchParams.toString());
        for (const [key, value] of Object.entries(params)) {
          if (value === null) next.delete(key);
          else next.set(key, value);
        }
        const qs = next.toString();
        const url = qs ? `${pathname}?${qs}` : pathname;
        if (options?.replace) router.replace(url, { scroll: false });
        else router.push(url, { scroll: false });
      },
      subscribe: () => () => {},
    }),
    [searchParams, pathname, router]
  );
}
