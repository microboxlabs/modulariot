import { CiCircleCheck } from "react-icons/ci";
import { I18nRecord } from "@/features/i18n/i18n.service.types";

export default function EndTreatment({ dict }: { dict: I18nRecord }) {
  return (
    <div className="h-full w-full flex flex-col items-center justify-center gap-2 p-5">
      <div className="flex flex-col items-center justify-center gap-2 flex-grow">
        <CiCircleCheck className="h-32 w-32 text-blue-500" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {(dict.symptoms as I18nRecord).end_treatment as string}
        </h1>
      </div>
    </div>
  );
}
