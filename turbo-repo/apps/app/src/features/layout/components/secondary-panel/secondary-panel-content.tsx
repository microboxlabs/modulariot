"use client";

import { useEffect, useState } from "react";
import { twMerge } from "tailwind-merge";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import type { PropsWithI18nDict } from "@/features/i18n/i18n.service.types";
import type { SidebarItem } from "../../types/common.types";
import SecondaryPanelHeader from "./secondary-panel-header";
import SecondaryPanelSearch from "./secondary-panel-search";
import SecondaryPanelItemList from "./secondary-panel-item-list";

interface SecondaryPanelContentProps {
  section: SidebarItem;
  sectionKey: string;
  isOpen: boolean;
  totals: Record<string, number | string>;
  onNavigate?: () => void;
}

export default function SecondaryPanelContent({
  section,
  sectionKey,
  isOpen,
  totals,
  dict,
  onNavigate,
}: Readonly<PropsWithI18nDict<SecondaryPanelContentProps>>) {
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    setSearchQuery("");
  }, [sectionKey]);

  return (
    <div
      className={twMerge(
        "flex h-full flex-col transition-opacity duration-100 ease-out",
        isOpen ? "opacity-100" : "pointer-events-none opacity-0"
      )}
    >
      <SecondaryPanelHeader
        icon={section.icon}
        label={trDynamic(section.label, dict)}
      />

      {section.searchable && (
        <SecondaryPanelSearch
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder={tr("searchPlaceholder", dict)}
          createAction={
            section.createAction
              ? {
                  href: section.createAction.href,
                  label: trDynamic(section.createAction.label, dict),
                }
              : undefined
          }
        />
      )}

      <SecondaryPanelItemList
        items={section.items ?? []}
        searchQuery={searchQuery}
        totals={totals}
        dict={dict}
        onNavigate={onNavigate}
      />
    </div>
  );
}
