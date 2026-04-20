"use client";

import { useEffect, useRef, useState } from "react";
import { twMerge } from "tailwind-merge";
import { useSidebarContext } from "@/features/sidebar/context/sidebar-context";
import { useSidebarNavigation } from "../../context/sidebar-navigation-context";
import { tr } from "@/features/i18n/tr.service";
import type { PropsWithI18nDict } from "@/features/i18n/i18n.service.types";
import type { SidebarItem } from "../../types/common.types";
import SecondaryPanelHeader from "./secondary-panel-header";
import SecondaryPanelSearch from "./secondary-panel-search";
import SecondaryPanelItemList from "./secondary-panel-item-list";

function findSection(
  items: SidebarItem[],
  label: string
): SidebarItem | undefined {
  return items.find((item) => item.label === label);
}

export default function SecondaryPanel({ dict }: Readonly<PropsWithI18nDict>) {
  const { desktop } = useSidebarContext();
  const { activeSection } = desktop;
  const { items, totals } = useSidebarNavigation();
  const [searchQuery, setSearchQuery] = useState("");

  const section = activeSection ? findSection(items, activeSection) : undefined;
  const isOpen = Boolean(section);

  // Reset search when section changes
  useEffect(() => {
    setSearchQuery("");
  }, [activeSection]);

  // Keep last section so content stays visible during close animation
  const lastSectionRef = useRef<SidebarItem | undefined>(section);
  if (section) {
    lastSectionRef.current = section;
  }

  const displayedSection = section ?? lastSectionRef.current;

  return (
    <div
      className={twMerge(
        "h-full overflow-hidden transition-[width] duration-300 ease-out will-change-[width]",
        isOpen ? "w-60" : "w-0"
      )}
    >
      <div
        className={twMerge(
          "flex h-full w-60 flex-col border-r",
          "bg-white dark:bg-gray-800",
          isOpen ? "border-gray-200 dark:border-gray-700" : "border-transparent"
        )}
      >
        {displayedSection && (
          <div
            className={twMerge(
              "flex h-full flex-col transition-opacity duration-100 ease-out",
              isOpen ? "opacity-100" : "pointer-events-none opacity-0"
            )}
          >
            <SecondaryPanelHeader
              icon={displayedSection.icon}
              label={tr(displayedSection.label, dict)}
            />

            {displayedSection.searchable && (
              <SecondaryPanelSearch
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder={tr("searchPlaceholder", dict)}
                createAction={
                  displayedSection.createAction
                    ? {
                        href: displayedSection.createAction.href,
                        label: tr(displayedSection.createAction.label, dict),
                      }
                    : undefined
                }
              />
            )}

            <SecondaryPanelItemList
              items={displayedSection.items ?? []}
              searchQuery={searchQuery}
              totals={totals}
              dict={dict}
            />
          </div>
        )}
      </div>
    </div>
  );
}
