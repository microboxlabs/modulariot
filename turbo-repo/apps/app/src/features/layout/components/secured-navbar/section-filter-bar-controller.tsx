"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { getNavegationParams } from "./searchbar/navegation_params";
import ParametrizedFilterBar from "./searchbar/parametrized-filter-bar";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";

const ENABLED = process.env.NEXT_PUBLIC_ENABLE_SECTION_FILTER_BAR === "true";

export function SectionFilterBar({ dict }: { readonly dict: I18nRecord }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (!ENABLED) return null;

  const segments = pathname.split("/").filter(Boolean);
  const finalPath = segments.at(-1);
  const parentPath = segments.at(-2);
  const allNavParams = getNavegationParams(dict, searchParams.size);

  if (
    parentPath &&
    parentPath in allNavParams &&
    !allNavParams[parentPath as keyof typeof allNavParams]
  ) {
    return null;
  }

  if (!finalPath || !(finalPath in allNavParams)) return null;

  const navParams = allNavParams[finalPath as keyof typeof allNavParams];
  if (!navParams || navParams.length === 0) return null;

  return (
    <div className="px-2 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 w-full shrink-0">
      <ParametrizedFilterBar dict={dict} navegation_params={navParams} />
    </div>
  );
}
