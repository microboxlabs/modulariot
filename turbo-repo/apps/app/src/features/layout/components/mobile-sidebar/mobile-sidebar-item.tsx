"use client";

import Link from "next/link";
import { twMerge } from "tailwind-merge";
import { usePermissions } from "@/features/auth/hooks/use-permissions";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import type { PropsWithI18nDict } from "@/features/i18n/i18n.service.types";
import type { SidebarItem } from "../../types/common.types";

interface MobileSidebarItemProps {
  item: SidebarItem;
  isActive: boolean;
  isSectionOpen: boolean;
  hasChildren: boolean;
  onClick: () => void;
}

export default function MobileSidebarItem({
  item,
  isActive,
  isSectionOpen,
  hasChildren,
  dict,
  onClick,
}: Readonly<PropsWithI18nDict<MobileSidebarItemProps>>) {
  const { hasPermission, userGroups } = usePermissions();

  const hasBlockedGroup = (item.blockedGroups ?? []).some((g) =>
    userGroups.includes(g)
  );
  if (hasBlockedGroup) return null;
  if (!hasPermission(item.requiredGroups ?? [])) return null;

  const Icon = item.icon;
  const translatedLabel = trDynamic(item.label, dict);
  const isDirect = !hasChildren;

  function getIconColor(): string {
    if (isActive) return "text-gray-900 dark:text-white";
    if (isSectionOpen) return "text-gray-700 dark:text-gray-200";
    return "text-gray-500 dark:text-gray-400";
  }

  const content = (
    <div
      className={twMerge(
        "flex h-12 w-12 items-center justify-center rounded-lg transition-colors",
        getIconColor(),
        "hover:text-gray-700 dark:hover:text-gray-200",
        isActive && "bg-gray-100 dark:bg-gray-700",
        isSectionOpen && !isActive && "bg-gray-50 dark:bg-gray-700/50",
        isDirect && "border border-dashed border-gray-300 dark:border-gray-600",
        isDirect &&
          isActive &&
          "border-solid border-gray-400 dark:border-gray-500"
      )}
    >
      {Icon && <Icon className="h-6 w-6" />}
    </div>
  );

  if (hasChildren) {
    return (
      <li>
        <button
          type="button"
          aria-label={translatedLabel}
          aria-expanded={isSectionOpen}
          onClick={onClick}
          className="flex w-full items-center justify-center"
        >
          {content}
        </button>
      </li>
    );
  }

  return (
    <li>
      <Link
        href={item.href ?? "#"}
        aria-label={translatedLabel}
        onClick={onClick}
        className="flex w-full items-center justify-center"
      >
        {content}
      </Link>
    </li>
  );
}
