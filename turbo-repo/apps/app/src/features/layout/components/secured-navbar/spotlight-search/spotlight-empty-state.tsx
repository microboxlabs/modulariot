import { memo } from "react";
import { HiClock } from "react-icons/hi";
import type { SpotlightItem } from "./types";
import { SpotlightRow } from "./spotlight-row";

interface SpotlightEmptyStateProps {
  recentItems: SpotlightItem[];
  recentLabel: string;
  onSelectRecent: (item: SpotlightItem) => void;
}

export const SpotlightEmptyState = memo(function SpotlightEmptyState({
  recentItems,
  recentLabel,
  onSelectRecent,
}: Readonly<SpotlightEmptyStateProps>) {
  if (!recentItems.length) return null;

  return (
    <div className="py-1">
      <div className="flex items-center gap-2 px-4 py-1.5 select-none">
        <HiClock className="h-3 w-3 shrink-0 text-gray-400 dark:text-gray-500" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
          {recentLabel}
        </span>
        <div className="h-px flex-1 bg-gray-100 dark:bg-gray-700" />
      </div>

      {recentItems.map((item) => (
        <SpotlightRow
          key={item.id}
          item={item}
          isSelected={false}
          onSelect={onSelectRecent}
          onHover={() => {}}
        />
      ))}
    </div>
  );
});
