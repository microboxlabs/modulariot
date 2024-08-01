"use client";
import { Sidebar } from "flowbite-react";
import Link from "next/link";
import { twMerge } from "tailwind-merge";
import { tr } from "@/features/i18n/tr.service";
import { SidebarItemProps } from "./sidebar-item.types";
import { PropsWithI18nDict } from "@/features/i18n/i18n.service.types";

export default function SidebarItem({
  href,
  target,
  icon,
  label,
  items,
  badge,
  pathname,
  dict,
}: PropsWithI18nDict<SidebarItemProps>) {
  if (items) {
    // const isOpen = items.some((item) => pathname.startsWith(item.href ?? ""));
    const isOpen = true;
    return (
      <Sidebar.Collapse
        icon={icon}
        label={label}
        open={isOpen}
        theme={{ list: "space-y-2 py-2  [&>li>div]:w-full" }}
      >
        {items.map((item) => (
          <Sidebar.Item
            key={item.label}
            as={Link}
            href={item.href}
            target={item.target}
            className={twMerge(
              "justify-center [&>*]:font-normal",
              pathname === item.href && "bg-gray-100 dark:bg-gray-700",
            )}
          >
            {tr(item.label, dict)}
          </Sidebar.Item>
        ))}
      </Sidebar.Collapse>
    );
  }

  return (
    <Sidebar.Item
      as={Link}
      href={href}
      target={target}
      icon={icon}
      label={badge}
      className={twMerge(pathname === href && "bg-gray-100 dark:bg-gray-700")}
    >
      {label}
    </Sidebar.Item>
  );
}
