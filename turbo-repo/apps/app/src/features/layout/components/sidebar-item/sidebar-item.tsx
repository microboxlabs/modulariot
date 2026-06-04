"use client";
import {
  SidebarCollapse,
  SidebarItem as FlowbiteSidebarItem,
} from "flowbite-react";
import Link from "next/link";
import { twMerge } from "tailwind-merge";
import { trDynamic } from "@/features/i18n/tr.service";
import { SidebarItemProps } from "./sidebar-item.types";
import { PropsWithI18nDict } from "@/features/i18n/i18n.service.types";
import { usePermissions } from "@/features/auth/hooks/use-permissions";
import { useSearchParams } from "next/navigation";

export default function SidebarItem({
  href,
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
  const searchParams = useSearchParams();

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
    const isHomeSection = href === "/home";
    return (
      <SidebarCollapse
        icon={icon}
        label={label}
        open={isOpen}
        theme={{ list: "space-y-2 py-2 [&>li>div]:w-full" }}
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

          // Render nested group as second-level SidebarCollapse
          if (item.items) {
            const isGroupOpen = item.items.some(
              (child) => pathname === child.href?.split("?")[0]
            );
            return (
              <SidebarCollapse
                key={item.label}
                label={trDynamic(item.label, dict)}
                open={isGroupOpen}
                theme={{ list: "space-y-2 py-2 [&>li>div]:w-full" }}
              >
                {item.items.map((child) => (
                  <FlowbiteSidebarItem
                    key={child.href ?? child.label}
                    href={child.href}
                    as={Link}
                    className={twMerge(
                      "justify-center [&>*]:font-normal",
                      (pathname === child.href?.split("?")[0] ||
                        (searchParams.toString() &&
                          child.href ===
                            pathname + "?" + searchParams.toString())) &&
                        "bg-gray-100 dark:bg-gray-700"
                    )}
                  >
                    {trDynamic(child.label, dict)}
                  </FlowbiteSidebarItem>
                ))}
              </SidebarCollapse>
            );
          }

          const itemTotal = item.totals?.[item.label] ?? totals?.[item.label];
          const badgeProps =
            isHomeSection ||
            itemTotal === undefined ||
            typeof itemTotal === "string"
              ? {}
              : (() => {
                  const count = getTotalCountBadges(itemTotal);
                  const labelColor = getLabelColor(count);
                  return { label: `${count}`, labelColor };
                })();

          return (
            <FlowbiteSidebarItem
              key={item.href ?? item.label}
              href={item.href}
              as={Link}
              icon={item.icon}
              className={twMerge(
                "justify-start [&>*]:font-normal [&>span]:min-w-0 [&>span]:overflow-hidden [&>span]:text-ellipsis",
                (pathname === item.href ||
                  (searchParams.toString() &&
                    item.href === pathname + "?" + searchParams.toString())) &&
                  "bg-gray-100 dark:bg-gray-700"
              )}
              {...badgeProps}
            >
              {trDynamic(item.label, dict)}
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
      icon={icon}
      label={badge}
      className={twMerge(
        (pathname === href ||
          (typeof href === "string" && pathname.startsWith(`${href}/`)) ||
          (searchParams.toString() &&
            href === pathname + "?" + searchParams.toString())) &&
          "bg-gray-100 dark:bg-gray-700",
        "[&_svg]:!w-6 [&_svg]:!h-6 [&_svg]:!min-w-6 [&_svg]:!min-h-6"
      )}
    >
      <span>{label}</span>
    </FlowbiteSidebarItem>
  );
}

function getTotalCountBadges(totals: number) {
  return totals || 0;
}

function getLabelColor(totals: number) {
  if (totals <= 0) return "success";
  if (totals >= 100) return "warning";
  return "info";
}
