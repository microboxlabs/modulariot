import { HiArrowUp, HiArrowDown } from "react-icons/hi2";
import { Pill } from "./pill";

interface SortPillRowProps {
  label: string;
  columns: string[];
  sortKey: string | null;
  sortDir: "asc" | "desc";
  getColumnLabel: (key: string) => string;
  onSortClick: (key: string) => void;
}

function SortIcon({ dir }: Readonly<{ dir: "asc" | "desc" }>) {
  if (dir === "asc") return <HiArrowUp className="h-3 w-3" />;
  return <HiArrowDown className="h-3 w-3" />;
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
          icon={sortKey === key ? <SortIcon dir={sortDir} /> : undefined}
        />
      ))}
    </div>
  );
}
