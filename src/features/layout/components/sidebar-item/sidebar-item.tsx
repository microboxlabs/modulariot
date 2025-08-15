"use client";
import {
  SidebarCollapse,
  SidebarItem as FlowbiteSidebarItem,
} from "flowbite-react";
import Link from "next/link";
import { twMerge } from "tailwind-merge";
import { tr } from "@/features/i18n/tr.service";
import { SidebarItemProps } from "./sidebar-item.types";
import { PropsWithI18nDict } from "@/features/i18n/i18n.service.types";
import { usePermissions } from "@/features/auth/hooks/use-permissions";

export default function SidebarItem({
  href,
  target,
  icon,
  label,
  items,
  badge,
  pathname,
  dict,
  totals,
  requiredGroups = [],
  blockedGroups = [],
}: PropsWithI18nDict<SidebarItemProps>) {
  const { hasPermission, userGroups } = usePermissions();

  // Check if user has any blocked groups
  const hasBlockedGroup = blockedGroups.some((group) =>
    userGroups.includes(group)
  );
  if (hasBlockedGroup) {
    return null; // Don't render the item if user has blocked groups
  }

  // If user doesn't have required permissions, don't render the item
  if (!hasPermission(requiredGroups)) {
    return null;
  }

  if (items) {
    const isOpen = true;
    return (
      <SidebarCollapse
        icon={icon}
        label={label}
        open={isOpen}
        theme={{ list: "space-y-2 py-2  [&>li>div]:w-full" }}
      >
        {items.map((item) => {
          // Check if user has any blocked groups for this sub-item
          const hasSubItemBlockedGroup = (item.blockedGroups || []).some(
            (group) => userGroups.includes(group)
          );
          if (hasSubItemBlockedGroup) {
            return null; // Don't render the sub-item if user has blocked groups
          }

          // Check permissions for each sub-item
          if (!hasPermission(item.requiredGroups ?? [])) {
            return null;
          }

          return (
            <FlowbiteSidebarItem
              key={item.label}
              href={item.href}
              target={item.target}
              as={Link}
              icon={item.icon}
              className={twMerge(
                "justify-center [&>*]:font-normal",
                pathname === item.href && "bg-gray-100 dark:bg-gray-700"
              )}
              label={getTotalCountBagaes(totals[item.label])}
              labelColor={
                getTotalCountBagaes(totals[item.label]) <= 0
                  ? "success"
                  : getTotalCountBagaes(totals[item.label]) >= 100
                    ? "warning"
                    : "info"
              }
            >
              {tr(item.label, dict)}
            </FlowbiteSidebarItem>
          );
        })}
      </SidebarCollapse>
    );
  }

  return (
    <FlowbiteSidebarItem
      as={Link}
      href={href}
      target={target}
      icon={icon}
      label={badge}
      className={twMerge(pathname === href && "bg-gray-100 dark:bg-gray-700")}
    >
      {label}
    </FlowbiteSidebarItem>
  );
}

function getTotalCountBagaes(totals: number) {
  return totals ? totals : 0;
}
