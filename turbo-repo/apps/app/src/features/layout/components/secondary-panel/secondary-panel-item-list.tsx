"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { twMerge } from "tailwind-merge";
import { usePermissions } from "@/features/auth/hooks/use-permissions";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import type { PropsWithI18nDict } from "@/features/i18n/i18n.service.types";
import type { SidebarItem } from "../../types/common.types";
import { pathNameWithoutLanguage } from "../../utils/utils";

interface SecondaryPanelItemListProps {
  items: SidebarItem[];
  searchQuery: string;
  totals: Record<string, number | string>;
  onNavigate?: () => void;
}

function isItemVisible(
  item: SidebarItem,
  userGroups: string[],
  hasPermission: (groups: string[], op?: "OR" | "AND") => boolean
): boolean {
  const hasBlockedGroup = (item.blockedGroups ?? []).some((g) =>
    userGroups.includes(g)
  );
  if (hasBlockedGroup) return false;
  return hasPermission(item.requiredGroups ?? []);
}

function matchesSearch(label: string, query: string): boolean {
  if (!query) return true;
  return label.toLowerCase().includes(query.toLowerCase());
}

function PanelChildItem({
  item,
  isActive,
  dict,
  totals,
  onNavigate,
}: Readonly<{
  item: SidebarItem;
  isActive: boolean;
  dict: PropsWithI18nDict["dict"];
  totals: Record<string, number | string>;
  onNavigate?: () => void;
}>) {
  const translatedLabel = trDynamic(item.label, dict);
  const itemTotal = item.totals?.[item.label] ?? totals[item.label];
  const showBadge = itemTotal !== undefined && typeof itemTotal === "number";

  return (
    <li>
      <Link
        href={item.href ?? "#"}
        onClick={onNavigate}
        className={twMerge(
          "flex items-center gap-2 px-4 py-2 text-sm transition-colors",
          "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700",
          isActive &&
            "bg-gray-100 font-medium text-gray-900 dark:bg-gray-700 dark:text-white"
        )}
      >
        <span className="min-w-0 flex-1 truncate">{translatedLabel}</span>
        {showBadge && (
          <span
            className={twMerge(
              "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium",
              "bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-300"
            )}
          >
            {itemTotal}
          </span>
        )}
      </Link>
    </li>
  );
}

function PanelNestedGroup({
  item,
  pathname,
  searchParams,
  searchQuery,
  dict,
  totals,
  userGroups,
  hasPermission,
  onNavigate,
}: Readonly<{
  item: SidebarItem;
  pathname: string;
  searchParams: string;
  searchQuery: string;
  dict: PropsWithI18nDict["dict"];
  totals: Record<string, number | string>;
  userGroups: string[];
  hasPermission: (groups: string[], op?: "OR" | "AND") => boolean;
  onNavigate?: () => void;
}>) {
  const translatedGroupLabel = trDynamic(item.label, dict);
  const visibleChildren = (item.items ?? []).filter(
    (child) =>
      isItemVisible(child, userGroups, hasPermission) &&
      matchesSearch(trDynamic(child.label, dict), searchQuery)
  );

  if (visibleChildren.length === 0) return null;

  return (
    <li>
      <div className="px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
        {translatedGroupLabel}
      </div>
      <ul className="space-y-0.5">
        {visibleChildren.map((child) => {
          const childPath = child.href?.split("?")[0];
          const isActive =
            pathname === childPath ||
            (searchParams && child.href === pathname + "?" + searchParams);

          return (
            <PanelChildItem
              key={child.href ?? child.label}
              item={child}
              isActive={Boolean(isActive)}
              dict={dict}
              totals={totals}
              onNavigate={onNavigate}
            />
          );
        })}
      </ul>
    </li>
  );
}

export default function SecondaryPanelItemList({
  items,
  searchQuery,
  totals,
  dict,
  onNavigate,
}: Readonly<PropsWithI18nDict<SecondaryPanelItemListProps>>) {
  const pathname = pathNameWithoutLanguage(usePathname());
  const searchParamsHook = useSearchParams();
  const searchParamsStr = searchParamsHook.toString();
  const { hasPermission, userGroups } = usePermissions();

  return (
    <ul className="flex-1 space-y-0.5 overflow-y-auto">
      {items.map((item) => {
        if (!isItemVisible(item, userGroups, hasPermission)) return null;

        const translatedLabel = trDynamic(item.label, dict);

        // Nested group (item has children)
        if (item.items && item.items.length > 0) {
          return (
            <PanelNestedGroup
              key={item.label}
              item={item}
              pathname={pathname}
              searchParams={searchParamsStr}
              searchQuery={searchQuery}
              dict={dict}
              totals={totals}
              userGroups={userGroups}
              hasPermission={hasPermission}
              onNavigate={onNavigate}
            />
          );
        }

        // Simple leaf item
        if (!matchesSearch(translatedLabel, searchQuery)) return null;

        const itemPath = item.href?.split("?")[0];
        const isActive =
          pathname === itemPath ||
          (searchParamsStr && item.href === pathname + "?" + searchParamsStr);

        return (
          <PanelChildItem
            key={item.href ?? item.label}
            item={item}
            isActive={Boolean(isActive)}
            dict={dict}
            totals={totals}
            onNavigate={onNavigate}
          />
        );
      })}
    </ul>
  );
}
