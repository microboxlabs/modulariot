"use client";

import { useEffect, useState, type ComponentProps, type FC } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { twMerge } from "tailwind-merge";
import { HiChevronDown } from "react-icons/hi";
import { usePermissions } from "@/features/auth/hooks/use-permissions";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import type { PropsWithI18nDict } from "@/features/i18n/i18n.service.types";
import type { SidebarItem } from "../../types/common.types";
import { isSegmentPrefix } from "../../utils/utils";

interface MobileSidebarSectionProps {
  item: SidebarItem;
  pathname: string;
  totals: Record<string, number | string>;
  onNavigate: () => void;
}

function isChildActive(
  childHref: string | undefined,
  pathname: string,
  searchParams: string
): boolean {
  if (!childHref) return false;
  const childPath = childHref.split("?")[0];
  return (
    pathname === childPath ||
    (Boolean(searchParams) && childHref === pathname + "?" + searchParams)
  );
}

function isSectionActive(item: SidebarItem, pathname: string): boolean {
  if (item.href && isSegmentPrefix(item.href, pathname)) return true;
  if (item.items) {
    return item.items.some((child) => {
      if (child.href && isSegmentPrefix(child.href, pathname)) return true;
      if (child.items) {
        return child.items.some((nested) => {
          return nested.href ? isSegmentPrefix(nested.href, pathname) : false;
        });
      }
      return false;
    });
  }
  return false;
}

function ChildItem({
  child,
  isActive,
  dict,
  totals,
  onNavigate,
}: Readonly<{
  child: SidebarItem;
  isActive: boolean;
  dict: PropsWithI18nDict["dict"];
  totals: Record<string, number | string>;
  onNavigate: () => void;
}>) {
  const translatedLabel = trDynamic(child.label, dict);
  const itemTotal = child.totals?.[child.label] ?? totals[child.label];
  const showBadge = itemTotal !== undefined && typeof itemTotal === "number";

  return (
    <li>
      <Link
        href={child.href ?? "#"}
        onClick={onNavigate}
        className={twMerge(
          "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
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

function NestedGroup({
  group,
  pathname,
  searchParams,
  dict,
  totals,
  userGroups,
  hasPermission,
  onNavigate,
}: Readonly<{
  group: SidebarItem;
  pathname: string;
  searchParams: string;
  dict: PropsWithI18nDict["dict"];
  totals: Record<string, number | string>;
  userGroups: string[];
  hasPermission: (groups: string[], op?: "OR" | "AND") => boolean;
  onNavigate: () => void;
}>) {
  const visibleChildren = (group.items ?? []).filter((child) => {
    const hasBlocked = (child.blockedGroups ?? []).some((g) =>
      userGroups.includes(g)
    );
    if (hasBlocked) return false;
    return hasPermission(child.requiredGroups ?? []);
  });

  if (visibleChildren.length === 0) return null;

  return (
    <li>
      <div className="px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
        {trDynamic(group.label, dict)}
      </div>
      <ul className="space-y-0.5">
        {visibleChildren.map((child) => (
          <ChildItem
            key={child.href ?? child.label}
            child={child}
            isActive={isChildActive(child.href, pathname, searchParams)}
            dict={dict}
            totals={totals}
            onNavigate={onNavigate}
          />
        ))}
      </ul>
    </li>
  );
}

export default function MobileSidebarSection({
  item,
  pathname,
  totals,
  dict,
  onNavigate,
}: Readonly<PropsWithI18nDict<MobileSidebarSectionProps>>) {
  const { hasPermission, userGroups } = usePermissions();
  const searchParamsHook = useSearchParams();
  const searchParamsStr = searchParamsHook.toString();

  const hasBlockedGroup = (item.blockedGroups ?? []).some((g) =>
    userGroups.includes(g)
  );
  if (hasBlockedGroup) return null;
  if (!hasPermission(item.requiredGroups ?? [])) return null;

  const hasChildren = Boolean(item.items && item.items.length > 0);
  const active = isSectionActive(item, pathname);
  const Icon = item.icon;

  // Sections with children: expandable accordion
  if (hasChildren) {
    return (
      <ExpandableSection
        item={item}
        icon={Icon}
        active={active}
        pathname={pathname}
        searchParams={searchParamsStr}
        totals={totals}
        dict={dict}
        userGroups={userGroups}
        hasPermission={hasPermission}
        onNavigate={onNavigate}
      />
    );
  }

  // Direct navigation item
  return (
    <li>
      <Link
        href={item.href ?? "#"}
        onClick={onNavigate}
        className={twMerge(
          "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
          "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700",
          active && "bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-white"
        )}
      >
        {Icon && (
          <Icon
            className={twMerge(
              "h-5 w-5 shrink-0",
              active
                ? "text-gray-900 dark:text-white"
                : "text-gray-500 dark:text-gray-400"
            )}
          />
        )}
        <span className="flex-1 truncate">{trDynamic(item.label, dict)}</span>
      </Link>
    </li>
  );
}

function ExpandableSection({
  item,
  icon: Icon,
  active,
  pathname,
  searchParams,
  totals,
  dict,
  userGroups,
  hasPermission,
  onNavigate,
}: Readonly<{
  item: SidebarItem;
  icon?: FC<ComponentProps<"svg">>;
  active: boolean;
  pathname: string;
  searchParams: string;
  totals: Record<string, number | string>;
  dict: PropsWithI18nDict["dict"];
  userGroups: string[];
  hasPermission: (groups: string[], op?: "OR" | "AND") => boolean;
  onNavigate: () => void;
}>) {
  const [isExpanded, setIsExpanded] = useState(active);

  useEffect(() => {
    if (active) setIsExpanded(true);
  }, [active]);

  const visibleItems = (item.items ?? []).filter((child) => {
    const hasBlocked = (child.blockedGroups ?? []).some((g) =>
      userGroups.includes(g)
    );
    if (hasBlocked) return false;
    return hasPermission(child.requiredGroups ?? []);
  });

  if (visibleItems.length === 0) return null;

  return (
    <li>
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className={twMerge(
          "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
          "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700",
          active && "bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-white"
        )}
      >
        {Icon && (
          <Icon
            className={twMerge(
              "h-5 w-5 shrink-0",
              active
                ? "text-gray-900 dark:text-white"
                : "text-gray-500 dark:text-gray-400"
            )}
          />
        )}
        <span className="flex-1 truncate text-left">
          {trDynamic(item.label, dict)}
        </span>
        <HiChevronDown
          className={twMerge(
            "h-4 w-4 shrink-0 transition-transform duration-150",
            isExpanded && "rotate-180"
          )}
        />
      </button>

      <div
        className={twMerge(
          "overflow-hidden transition-[grid-template-rows] duration-150 ease-out",
          "grid",
          isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div className="min-h-0">
          <ul className="space-y-0.5 py-1 pl-5">
            {visibleItems.map((child) => {
              // Nested group (child has its own items)
              if (child.items) {
                return (
                  <NestedGroup
                    key={child.label}
                    group={child}
                    pathname={pathname}
                    searchParams={searchParams}
                    dict={dict}
                    totals={totals}
                    userGroups={userGroups}
                    hasPermission={hasPermission}
                    onNavigate={onNavigate}
                  />
                );
              }

              return (
                <ChildItem
                  key={child.href ?? child.label}
                  child={child}
                  isActive={isChildActive(child.href, pathname, searchParams)}
                  dict={dict}
                  totals={totals}
                  onNavigate={onNavigate}
                />
              );
            })}
          </ul>
        </div>
      </div>
    </li>
  );
}
