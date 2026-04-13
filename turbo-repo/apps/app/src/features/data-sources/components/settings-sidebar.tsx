"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { HiCog, HiDatabase, HiOfficeBuilding } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";

const navItems = [
  { key: "general", href: "/users/settings", icon: HiCog, labelKey: "general" },
  { key: "organizations", href: "/users/settings/organizations", icon: HiOfficeBuilding, labelKey: "organizations" },
  { key: "data-sources", href: "/users/settings/data-sources", icon: HiDatabase, labelKey: "dataSources" },
];

interface SettingsSidebarProps {
  readonly dict: I18nRecord;
}

export function SettingsSidebar({ dict }: SettingsSidebarProps) {
  const pathname = usePathname();
  const params = useParams();
  const lang = params.lang as string;

  return (
    <aside className="w-56 shrink-0 border-r border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
      <nav className="flex flex-col gap-1 p-3">
        <h3 className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          {tr("title", dict)}
        </h3>
        {navItems.map((item) => {
          const fullHref = `/${lang}${item.href}`;
          const isActive =
            item.key === "general"
              ? pathname === fullHref
              : pathname.startsWith(fullHref);

          return (
            <Link
              key={item.key}
              href={fullHref}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                  : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
              }`}
            >
              <item.icon className="h-4 w-4" />
              {tr(item.labelKey, dict)}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
