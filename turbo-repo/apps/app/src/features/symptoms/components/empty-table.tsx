import { I18nRecord } from "@/features/i18n/i18n.service.types";
import type { SymptomConstellationCounts } from "../types/symptoms";
import EmptyAnimation from "./empty-animation";

export default function EmptyTable({
  dict,
  counts,
  hint,
}: Readonly<{
  dict: I18nRecord;
  counts?: SymptomConstellationCounts;
  /** Why the list is empty, when the filters explain it. */
  hint?: string;
}>) {
  return (
    <div className="flex flex-col justify-center items-center w-full h-full">
      <EmptyAnimation counts={counts} dict={dict} />
      <p className="text-lg text-gray-500 mt-10">
        {(dict.symptoms as I18nRecord).no_active_conditions as string}
      </p>
      <p className="text-sm font-light text-gray-400">
        {(dict.symptoms as I18nRecord).normal_operation as string}
      </p>
      <p className="text-sm font-light text-gray-400">
        {(dict.symptoms as I18nRecord).check_later as string}
      </p>
      {hint && (
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-300">{hint}</p>
      )}
    </div>
  );
}
