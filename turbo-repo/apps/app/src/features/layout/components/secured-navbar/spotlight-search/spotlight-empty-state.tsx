import { memo } from "react";
import { HiArrowRight, HiClock } from "react-icons/hi";
import type { SpotlightItem } from "./types";

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

      {recentItems.map((item) => {
        const ItemIcon = item.icon ?? HiArrowRight;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelectRecent(item)}
            className="flex w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50"
          >
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-gray-100 ring-1 ring-inset ring-black/6 dark:bg-gray-700 dark:ring-white/10">
              <ItemIcon className="h-3 w-3 text-gray-500 dark:text-gray-400" />
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              {item.sublabel && (
                <span className="truncate text-[10px] text-gray-400 dark:text-gray-500">
                  {item.sublabel}
                </span>
              )}
              <span className="truncate text-sm text-gray-600 dark:text-gray-300">
                {item.label}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
});
