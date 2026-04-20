"use client";

import { useRef } from "react";
import { twMerge } from "tailwind-merge";
import { useSidebarContext } from "@/features/sidebar/context/sidebar-context";
import { useSidebarNavigation } from "../../context/sidebar-navigation-context";
import type { PropsWithI18nDict } from "@/features/i18n/i18n.service.types";
import type { SidebarItem } from "../../types/common.types";
import SecondaryPanelContent from "./secondary-panel-content";

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

  const section = activeSection ? findSection(items, activeSection) : undefined;
  const isOpen = Boolean(section);

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
          <SecondaryPanelContent
            section={displayedSection}
            sectionKey={activeSection ?? ""}
            isOpen={isOpen}
            totals={totals}
            dict={dict}
          />
        )}
      </div>
    </div>
  );
}
