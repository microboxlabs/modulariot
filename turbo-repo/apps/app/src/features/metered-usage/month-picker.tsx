import { Button } from "flowbite-react";
import { HiChevronLeft, HiChevronRight } from "react-icons/hi";
import { monthLabel, monthOf, shiftMonth } from "./usage-view";

/** "Octubre de 2026": only the first letter in upper case, so "de" stays lower case. */
function title(month: string, lang: string) {
  const label = monthLabel(month, lang);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Steps one month back or forward, never past the current month. */
export default function MonthPicker({
  month,
  onMonth,
  lang,
  previousLabel,
  nextLabel,
}: Readonly<{
  month: string;
  onMonth: (month: string) => void;
  lang: string;
  previousLabel: string;
  nextLabel: string;
}>) {
  const isCurrent = month >= monthOf(new Date());
  return (
    <div className="flex items-center gap-2">
      <Button
        size="xs"
        color="light"
        aria-label={previousLabel}
        onClick={() => onMonth(shiftMonth(month, -1))}
      >
        <HiChevronLeft className="h-4 w-4" />
      </Button>
      <span className="min-w-36 text-center text-sm font-medium text-gray-900 dark:text-white">
        {title(month, lang)}
      </span>
      <Button
        size="xs"
        color="light"
        aria-label={nextLabel}
        disabled={isCurrent}
        onClick={() => onMonth(shiftMonth(month, 1))}
      >
        <HiChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
