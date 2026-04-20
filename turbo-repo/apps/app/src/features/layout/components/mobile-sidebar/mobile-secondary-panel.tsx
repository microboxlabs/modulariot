"use client";

import { twMerge } from "tailwind-merge";
import type { PropsWithI18nDict } from "@/features/i18n/i18n.service.types";
import type { SidebarItem } from "../../types/common.types";
import SecondaryPanelContent from "../secondary-panel/secondary-panel-content";

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
        {section && (
          <SecondaryPanelContent
            section={section}
            sectionKey={section.label}
            isOpen={isOpen}
            totals={totals}
            dict={dict}
            onNavigate={onNavigate}
          />
        )}
      </div>
    </div>
  );
}
