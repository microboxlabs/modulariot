"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { twMerge } from "tailwind-merge";
import { HiCog } from "react-icons/hi";
import Link from "next/link";
import { useSidebarContext } from "@/features/sidebar/context/sidebar-context";
import type { PropsWithI18nDict } from "@/features/i18n/i18n.service.types";
import { pathNameWithoutLanguage } from "../../utils/utils";
import { tr } from "@/features/i18n/tr.service";
import { useSidebarNavigation } from "../../context/sidebar-navigation-context";
import type { SidebarItem } from "../../types/common.types";
import MobileSidebarItem from "./mobile-sidebar-item";
import MobileSecondaryPanel from "./mobile-secondary-panel";
import LifeSaver from "../bottom-menu/LifeSaver";

function isItemActive(item: SidebarItem, pathname: string): boolean {
  if (item.href && pathname.startsWith(item.href)) return true;
  if (item.items) {
    return item.items.some((child) => {
      const childPath = child.href?.split("?")[0];
      if (childPath && pathname.startsWith(childPath)) return true;
      if (child.items) {
        return child.items.some((nested) => {
          const nestedPath = nested.href?.split("?")[0];
          return nestedPath ? pathname.startsWith(nestedPath) : false;
        });
      }
      return false;
    });
  }
  return false;
}

function findActiveSectionLabel(
  items: SidebarItem[],
  pathname: string
): string | null {
  for (const item of items) {
    const hasChildren = Boolean(item.items && item.items.length > 0);
    if (hasChildren && isItemActive(item, pathname)) return item.label;
  }
  return null;
}

export default function MobileSidebar({ dict }: Readonly<PropsWithI18nDict>) {
  const pathname = pathNameWithoutLanguage(usePathname());
  const { isOpen, close } = useSidebarContext().mobile;
  const { items, totals } = useSidebarNavigation();
  const [activeSection, setActiveSection] = useState<string | null>(null);

  // Reset activeSection each time the sidebar opens
  const prevIsOpen = useRef(false);
  useEffect(() => {
    if (isOpen && !prevIsOpen.current) {
      setActiveSection(findActiveSectionLabel(items, pathname));
    }
    prevIsOpen.current = isOpen;
  }, [isOpen, items, pathname]);

  if (!isOpen) return null;

  const section = activeSection
    ? items.find((i) => i.label === activeSection)
    : undefined;
  const isPanelOpen = Boolean(section);

  function handleItemClick(item: SidebarItem) {
    const hasChildren = Boolean(
      (item.items && item.items.length > 0) || item.dynamicItemsSource
    );
    if (hasChildren) {
      setActiveSection((prev) => (prev === item.label ? null : item.label));
    } else {
      close();
    }
  }

  return (
    <>
      <nav
        aria-label="Mobile navigation"
        className={twMerge(
          "fixed inset-y-0 left-0 z-20 flex border-r border-gray-200 pt-16",
          "bg-white dark:border-gray-700 dark:bg-gray-800"
        )}
      >
        {/* L1 — Icon bar (always icon-only) */}
        <div className="flex h-full w-14 flex-col">
          <div className="flex flex-1 flex-col overflow-y-auto py-2">
            <ul className="flex flex-1 flex-col items-center gap-0.5">
              {items.map((item) => {
                const hasChildren = Boolean(
                  (item.items && item.items.length > 0) ||
                  item.dynamicItemsSource
                );
                const active = isItemActive(item, pathname);
                const isSectionOpen = activeSection === item.label;

                return (
                  <MobileSidebarItem
                    key={item.label}
                    item={item}
                    isActive={active}
                    isSectionOpen={isSectionOpen}
                    hasChildren={hasChildren}
                    dict={dict}
                    onClick={() => handleItemClick(item)}
                  />
                );
              })}
            </ul>
          </div>

          {/* Bottom icons */}
          <div className="flex flex-col items-center gap-1 border-t border-gray-200 py-2 dark:border-gray-700">
            <Link
              href="/users/settings"
              onClick={close}
              className={twMerge(
                "flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
                "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200",
                pathname === "/users/settings" &&
                  "bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-white"
              )}
              aria-label={tr("settings", dict)}
            >
              <HiCog className="h-5 w-5" />
            </Link>
            <Link
              href="#"
              className={twMerge(
                "flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
                "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              )}
              aria-label={tr("help", dict)}
            >
              <LifeSaver />
            </Link>
          </div>
        </div>

        {/* L2 — Secondary panel */}
        <MobileSecondaryPanel
          section={section}
          isOpen={isPanelOpen}
          totals={totals}
          dict={dict}
          onNavigate={close}
        />
      </nav>

      {/* Backdrop */}
      <div
        onClick={() => {
          setActiveSection(null);
          close();
        }}
        aria-hidden="true"
        className="fixed inset-0 z-10 bg-gray-900/50 pt-16 dark:bg-gray-900/90"
      />
    </>
  );
}
