import type { ReactNode } from "react";
import { Spinner } from "flowbite-react";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import MonthPicker from "./month-picker";
import UsageNotice from "./usage-notice";

/**
 * The frame of an organization's "Uso del mes": title, month picker, the
 * loading and error states, then the notices and cards.
 */
export default function UsageMonthSection({
  dict,
  month,
  onMonth,
  lang,
  isLoading,
  error,
  children,
}: Readonly<{
  dict: I18nRecord;
  month: string;
  onMonth: (month: string) => void;
  lang: string;
  isLoading: boolean;
  error: { status: number } | null;
  children: ReactNode;
}>) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {tr("title", dict)}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {tr("description", dict)}
          </p>
        </div>
        <MonthPicker
          month={month}
          onMonth={onMonth}
          lang={lang}
          previousLabel={tr("previousMonth", dict)}
          nextLabel={tr("nextMonth", dict)}
        />
      </div>

      {isLoading && <Spinner size="md" />}
      {error && (
        <UsageNotice tone="error">
          {error.status === 403 ? tr("forbidden", dict) : tr("loadError", dict)}
        </UsageNotice>
      )}
      {!isLoading && !error && children}
    </section>
  );
}
