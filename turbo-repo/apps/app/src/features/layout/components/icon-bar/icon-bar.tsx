"use client";

import { usePathname } from "next/navigation";
import { twMerge } from "tailwind-merge";
import { useSidebarContext } from "@/features/sidebar/context/sidebar-context";
import { useSidebarNavigation } from "../../context/sidebar-navigation-context";
import { pathNameWithoutLanguage, isSegmentPrefix } from "../../utils/utils";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import type { PropsWithI18nDict } from "@/features/i18n/i18n.service.types";
import type { SidebarItem } from "../../types/common.types";
import IconBarItem from "./icon-bar-item";

const SETTINGS_SECTION_LABEL = "settings";

function isItemActive(item: SidebarItem, pathname: string): boolean {
  if (item.href && isSegmentPrefix(item.href, pathname)) return true;
  if (item.items) {
    return item.items.some((child) => {
      return child.href ? isSegmentPrefix(child.href, pathname) : false;
    });
  }
  return false;
}

export default function IconBar({ dict }: Readonly<PropsWithI18nDict>) {
  const pathname = pathNameWithoutLanguage(usePathname());
  const { items } = useSidebarNavigation();
  const { desktop } = useSidebarContext();
  const { activeSection, setActiveSection, toggleSection } = desktop;
  const settingsItem = items.find(
    (item) => item.label === SETTINGS_SECTION_LABEL
  );
  const SettingsIcon = settingsItem?.icon;

  function handleItemClick(item: SidebarItem) {
    if (item.items || item.dynamicItemsSource) {
      toggleSection(item.label);
    } else {
      setActiveSection(null);
    }
  }

  return (
    <nav
      aria-label="Main navigation"
      className={twMerge(
        "flex h-full w-14 flex-col items-center border-r border-gray-200",
        "bg-white py-2 dark:border-gray-700 dark:bg-gray-800"
      )}
    >
      <ul className="flex flex-1 flex-col items-center gap-0.5">
        {items
          .filter((item) => item.label !== SETTINGS_SECTION_LABEL)
          .map((item) => {
            const hasChildren = Boolean(
              (item.items && item.items.length > 0) || item.dynamicItemsSource
            );
            const active = isItemActive(item, pathname);
            const isPanelOpen = activeSection === item.label;

            return (
              <IconBarItem
                key={item.label}
                icon={item.icon}
                label={item.label}
                translatedLabel={trDynamic(item.label, dict)}
                href={item.href}
                hasChildren={hasChildren}
                isActive={active}
                isPanelOpen={isPanelOpen}
                requiredGroups={item.requiredGroups}
                blockedGroups={item.blockedGroups}
                onClick={() => handleItemClick(item)}
              />
            );
          })}
      </ul>

      {/* Bottom icons */}
      <div className="flex flex-col items-center gap-1 border-t border-gray-200 pt-3 dark:border-gray-700">
        <button
          type="button"
          onClick={() => toggleSection(SETTINGS_SECTION_LABEL)}
          className={twMerge(
            "flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
            "text-gray-500 dark:text-gray-400",
            "hover:text-gray-700 dark:hover:text-gray-200",
            (isSegmentPrefix("/users/settings", pathname) ||
              activeSection === SETTINGS_SECTION_LABEL) &&
              "text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-700"
          )}
          aria-label={tr("settings", dict)}
          aria-expanded={activeSection === SETTINGS_SECTION_LABEL}
        >
          {SettingsIcon && <SettingsIcon className="h-5 w-5" />}
        </button>
      </div>
    </nav>
  );
}
