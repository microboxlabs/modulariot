"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { HiArrowDown, HiArrowUp, HiChevronDown } from "react-icons/hi2";
import { BADGE_ACTIVE, BADGE_BASE, BADGE_IDLE } from "./badge-styles";

interface SortToggleBadgeProps {
  readonly paramKey: string;
  readonly label: string;
  readonly ascValue?: string;
  readonly descValue?: string;
}

/**
 * Tri-state sort toggle styled like the other filter-bar badges: unactive →
 * asc → desc → unactive, driven by a URL search param (so it's bookmarkable
 * and consistent with the rest of the URL-driven filter bar).
 */
export function SortToggleBadge({
  paramKey,
  label,
  ascValue = "asc",
  descValue = "desc",
}: Readonly<SortToggleBadgeProps>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get(paramKey);

  const handleClick = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (current === ascValue) {
      params.set(paramKey, descValue);
    } else if (current === descValue) {
      params.delete(paramKey);
    } else {
      params.set(paramKey, ascValue);
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }, [current, ascValue, descValue, paramKey, pathname, router, searchParams]);

  const isActive = current === ascValue || current === descValue;

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`${BADGE_BASE} ${isActive ? BADGE_ACTIVE : BADGE_IDLE}`}
    >
      <span>{label}</span>
      {current === ascValue && <HiArrowUp className="h-3 w-3" />}
      {current === descValue && <HiArrowDown className="h-3 w-3" />}
      {!isActive && <HiChevronDown className="h-3 w-3 opacity-50" />}
    </button>
  );
}
