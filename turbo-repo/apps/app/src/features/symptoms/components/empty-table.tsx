import { I18nRecord } from "@/features/i18n/i18n.service.types";
import EmptyAnimation from "./empty-animation";

export default function EmptyTable({
  dict,
  hint,
}: Readonly<{
  dict: I18nRecord;
  /** Why the list is empty, when the filters explain it. */
  hint?: string;
}>) {
  return (
    <div className="flex flex-col justify-center items-center w-full h-full">
      <EmptyAnimation />
      {hint ? (
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-300">{hint}</p>
      ) : (
        <>
          <p className="text-lg text-gray-500 mt-10">
            {(dict.symptoms as I18nRecord).no_active_conditions as string}
          </p>
          <p className="text-sm font-light text-gray-400">
            {(dict.symptoms as I18nRecord).normal_operation as string}
          </p>
          <p className="text-sm font-light text-gray-400">
            {(dict.symptoms as I18nRecord).check_later as string}
          </p>
        </>
      )}
    </div>
  );
}
