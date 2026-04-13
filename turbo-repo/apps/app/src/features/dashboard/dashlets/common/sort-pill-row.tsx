import { HiArrowUp, HiArrowDown } from "react-icons/hi2";
import { Pill } from "./pill";

interface SortPillRowProps {
  label: string;
  columns: string[];
  sortKey: string;
  sortDir: "asc" | "desc";
  getColumnLabel: (key: string) => string;
  onSortClick: (key: string) => void;
}

export function SortPillRow({
  label,
  columns,
  sortKey,
  sortDir,
  getColumnLabel,
  onSortClick,
}: Readonly<SortPillRowProps>) {
  if (columns.length === 0) return null;

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
      <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
      {columns.map((key) => (
        <Pill
          key={key}
          label={getColumnLabel(key)}
          active={sortKey === key}
          onClick={() => onSortClick(key)}
          icon={
            sortKey === key ? (
              sortDir === "asc" ? (
                <HiArrowUp className="h-3 w-3" />
              ) : (
                <HiArrowDown className="h-3 w-3" />
              )
            ) : undefined
          }
        />
      ))}
    </div>
  );
}
