import { memo, useCallback, useEffect, useRef } from "react";
import { HiArrowRight } from "react-icons/hi";
import type { SpotlightItem } from "./types";

function getRowBg(isSelected: boolean, useAmberAccent: boolean): string {
  if (isSelected) {
    return useAmberAccent ? "bg-amber-100 dark:bg-amber-800/40" : "bg-gray-100 dark:bg-gray-700/70";
  }
  return useAmberAccent ? "hover:bg-amber-50 dark:hover:bg-amber-900/20" : "hover:bg-gray-50 dark:hover:bg-gray-700/50";
}

function getLabelClass(isHarnessGoto: boolean, isHarness: boolean): string {
  if (isHarnessGoto) return "font-medium text-amber-600 dark:text-amber-400";
  if (isHarness) return "font-medium text-gray-800 dark:text-white";
  return "text-gray-600 dark:text-gray-300";
}

interface SpotlightRowProps {
  item: SpotlightItem;
  isSelected: boolean;
  onSelect: (item: SpotlightItem) => void;
  onHover: (id: string | null) => void;
  /** When true, uses amber hover bg and selected bg (harness prompt only) */
  accentHover?: boolean;
}

export const SpotlightRow = memo(function SpotlightRow({
  item,
  isSelected,
  onSelect,
  onHover,
  accentHover = false,
}: Readonly<SpotlightRowProps>) {
  const ref = useRef<HTMLButtonElement>(null);

  const handleClick = useCallback(() => onSelect(item), [onSelect, item]);
  const handleMouseEnter = useCallback(() => onHover(item.id), [onHover, item.id]);
  const handleMouseLeave = useCallback(() => onHover(null), [onHover]);

  useEffect(() => {
    if (isSelected) ref.current?.scrollIntoView({ block: "nearest" });
  }, [isSelected]);

  const ItemIcon = item.icon ?? HiArrowRight;
  const isHarness = item.kind === "harness" || item.kind === "harness-goto";
  const useAmberAccent = accentHover || isHarness;

  const iconClass = isHarness ? "text-white" : "text-gray-500 dark:text-gray-400";

  const iconBgClass = isHarness
    ? "bg-linear-to-br from-[rgb(241,179,0)] to-[rgb(209,137,0)]"
    : "bg-gray-100 dark:bg-gray-700";

  const rowBg = getRowBg(isSelected, useAmberAccent);

  return (
    <button
      ref={ref}
      type="button"
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`flex w-full items-center gap-3 px-4 py-2 text-left transition-colors ${rowBg}`}
    >
      <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ring-1 ring-inset ring-black/6 dark:ring-white/10 ${iconBgClass}`}>
        <ItemIcon className={`h-3 w-3 ${iconClass}`} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        {item.sublabel && (
          <span className={`truncate text-[10px] font-medium ${isHarness ? "text-amber-600 dark:text-amber-400" : "text-gray-400 dark:text-gray-500"}`}>
            {item.sublabel}
          </span>
        )}
        <span className={`truncate text-sm ${getLabelClass(item.kind === "harness-goto", isHarness)}`}>
          {item.label}
        </span>
      </div>
    </button>
  );
});
