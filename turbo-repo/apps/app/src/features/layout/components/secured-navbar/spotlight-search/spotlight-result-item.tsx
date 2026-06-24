import { memo, useCallback, useEffect, useRef } from "react";
import { HiArrowRight } from "react-icons/hi";
import type { SpotlightItem } from "./types";

interface SpotlightResultItemProps {
  item: SpotlightItem;
  isSelected: boolean;
  onSelect: (item: SpotlightItem) => void;
  onHover: (id: string | null) => void;
}

export const SpotlightResultItem = memo(function SpotlightResultItem({
  item,
  isSelected,
  onSelect,
  onHover,
}: Readonly<SpotlightResultItemProps>) {
  const ref = useRef<HTMLButtonElement>(null);

  const handleClick = useCallback(() => onSelect(item), [onSelect, item]);
  const handleMouseEnter = useCallback(() => onHover(item.id), [onHover, item.id]);
  const handleMouseLeave = useCallback(() => onHover(null), [onHover]);

  // Keep the selected row visible when keyboard-navigating.
  useEffect(() => {
    if (isSelected) ref.current?.scrollIntoView({ block: "nearest" });
  }, [isSelected]);

  const ItemIcon = item.icon ?? HiArrowRight;

  return (
    <button
      ref={ref}
      type="button"
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
        isSelected
          ? "bg-indigo-50 dark:bg-indigo-900/30"
          : "hover:bg-gray-50 dark:hover:bg-gray-700/50"
      }`}
    >
      <div
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ring-black/6 dark:ring-white/10 transition-colors ${
          isSelected
            ? "bg-indigo-100 dark:bg-indigo-800/60"
            : "bg-gray-100 dark:bg-gray-700"
        }`}
      >
        <ItemIcon
          className={`h-3.5 w-3.5 transition-colors ${
            isSelected
              ? "text-indigo-600 dark:text-indigo-400"
              : "text-gray-500 dark:text-gray-400"
          }`}
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        {item.sublabel && (
          <span className="truncate text-[10px] text-gray-400 dark:text-gray-500">
            {item.sublabel}
          </span>
        )}
        <span
          className={`truncate text-sm font-medium transition-colors ${
            isSelected
              ? "text-indigo-800 dark:text-indigo-200"
              : "text-gray-700 dark:text-gray-200"
          }`}
        >
          {item.label}
        </span>
      </div>
    </button>
  );
});
