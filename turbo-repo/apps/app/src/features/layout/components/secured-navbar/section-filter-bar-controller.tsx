"use client";

import { usePathname, useSearchParams } from "next/navigation";
import {
  getNavegationParams,
  getSortToggleParam,
} from "./searchbar/navegation_params";
import ParametrizedFilterBar from "./searchbar/parametrized-filter-bar";
import { SortToggleBadge } from "@/features/dashboard/components/dashboard-filters-card/sort-toggle-badge";
import { resolveSection, segmentsOf } from "./resolve-section";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";

export function SectionFilterBar({ dict }: { readonly dict: I18nRecord }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const segments = segmentsOf(pathname);
  const finalPath = resolveSection(segments);
  const parentPath = segments.at(-2);
  const allNavParams = getNavegationParams(dict, searchParams.size);

  if (
    parentPath &&
    parentPath in allNavParams &&
    !allNavParams[parentPath as keyof typeof allNavParams]
  ) {
    return null;
  }

  const navParams =
    finalPath && finalPath in allNavParams
      ? allNavParams[finalPath as keyof typeof allNavParams]
      : null;
  const sortToggle = getSortToggleParam(finalPath);

  if ((!navParams || navParams.length === 0) && !sortToggle) return null;

  return (
    <div className="px-2 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 w-full shrink-0">
      <div className="flex flex-wrap items-center gap-2">
        {navParams && navParams.length > 0 && (
          <ParametrizedFilterBar dict={dict} navegation_params={navParams} />
        )}
        {sortToggle && (
          <SortToggleBadge
            paramKey={sortToggle.key}
            label={sortToggle.label}
          />
        )}
      </div>
    </div>
  );
}
