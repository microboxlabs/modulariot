import type { ReactNode } from "react";
import { Spinner } from "flowbite-react";
import MonthPicker from "./month-picker";
import UsageNotice from "./usage-notice";

/**
 * The frame of an organization's "Uso del mes": title, month picker, the
 * loading and error states, then the notices and cards.
 */
export default function UsageMonthSection({
  title,
  description,
  month,
  onMonth,
  lang,
  previousLabel,
  nextLabel,
  isLoading,
  error,
  children,
}: Readonly<{
  title: string;
  description: string;
  month: string;
  onMonth: (month: string) => void;
  lang: string;
  previousLabel: string;
  nextLabel: string;
  isLoading: boolean;
  /** The message to show, or null. */
  error: string | null;
  children: ReactNode;
}>) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {title}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {description}
          </p>
        </div>
        <MonthPicker
          month={month}
          onMonth={onMonth}
          lang={lang}
          previousLabel={previousLabel}
          nextLabel={nextLabel}
        />
      </div>

      {isLoading && <Spinner size="md" />}
      {error && <UsageNotice tone="error">{error}</UsageNotice>}
      {!isLoading && !error && children}
    </section>
  );
}
