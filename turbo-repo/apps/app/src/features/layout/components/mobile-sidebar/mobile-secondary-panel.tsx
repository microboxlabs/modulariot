"use client";

import { useEffect, useState } from "react";
import { twMerge } from "tailwind-merge";
import { tr } from "@/features/i18n/tr.service";
import type { PropsWithI18nDict } from "@/features/i18n/i18n.service.types";
import type { SidebarItem } from "../../types/common.types";
import SecondaryPanelHeader from "../secondary-panel/secondary-panel-header";
import SecondaryPanelSearch from "../secondary-panel/secondary-panel-search";
import SecondaryPanelItemList from "../secondary-panel/secondary-panel-item-list";

interface MobileSecondaryPanelProps {
  section: SidebarItem | undefined;
  isOpen: boolean;
  totals: Record<string, number | string>;
  onNavigate: () => void;
}

export default function MobileSecondaryPanel({
  section,
  isOpen,
  totals,
  dict,
  onNavigate,
}: Readonly<PropsWithI18nDict<MobileSecondaryPanelProps>>) {
  const [searchQuery, setSearchQuery] = useState("");

  // Reset search when section changes
  useEffect(() => {
    setSearchQuery("");
  }, [section?.label]);

  const displayedSection = section;

  return (
    <div
      className={twMerge(
        "h-full overflow-hidden transition-[width] duration-200 ease-out",
        isOpen ? "w-56 border-l border-gray-200 dark:border-gray-700" : "w-0"
      )}
    >
      <div
        className={twMerge(
          "flex h-full w-56 flex-col",
          "bg-white dark:bg-gray-800"
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
              onNavigate={onNavigate}
            />
          </div>
        )}
      </div>
    </div>
  );
}
