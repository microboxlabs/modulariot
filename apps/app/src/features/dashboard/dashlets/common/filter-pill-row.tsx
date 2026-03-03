import type { FilterItemConfig } from "./filter-types";
import { Pill } from "./pill";

interface FilterPillRowProps {
  item: FilterItemConfig;
  options: string[];
  selected: string;
  allLabel: string;
  onClear: (column: string) => void;
  onSelect: (column: string, value: string) => void;
}

export function FilterPillRow({
  item,
  options,
  selected,
  allLabel,
  onClear,
  onSelect,
}: Readonly<FilterPillRowProps>) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
      <span className="text-sm text-gray-500 dark:text-gray-400">
        {item.label}
      </span>
      <Pill
        label={allLabel}
        active={selected === ""}
        onClick={() => onClear(item.column)}
      />
      {options.map((val) => (
        <Pill
          key={val}
          label={val}
          active={selected === val}
          onClick={() => onSelect(item.column, val)}
        />
      ))}
    </div>
  );
}
