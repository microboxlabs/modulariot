import CustomCard from "./custom-card";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import StatusCardSkeleton from "./status-card-skeleton";

export default function CardSkeleton({ dict }: { dict: I18nRecord }) {
  return (
    <div className="flex flex-col">
      <h1 className="ml-5 text-xl font-bold tracking-tight text-gray-900 dark:text-white">
        {(dict.symptoms as I18nRecord).symptoms as string}
      </h1>
      <div className="relative pb-3 px-5 pt-2 flex flex-row md:flex-row gap-4 overflow-x-auto">
        <CustomCard>
          <div className="flex items-center gap-2">
            <div className="w-[35px] h-[35px] bg-gray-300 dark:bg-gray-700 rounded-md animate-pulse" />
            <h5 className=" tracking-tight bg-gray-300 dark:bg-gray-700 text-gray-300 dark:text-gray-700 rounded-sm animate-pulse hidden lg:block text-nowrap leading-tight text-base font-semibold">
              {(dict.symptoms as I18nRecord).urgent_symptoms as string}
            </h5>
          </div>
          <div className="flex gap-3 w-full">
            <StatusCardSkeleton />
          </div>
        </CustomCard>
        <CustomCard>
          <div className="flex items-center gap-2">
            <div className="w-[35px] h-[35px] bg-gray-300 dark:bg-gray-700 rounded-md animate-pulse" />
            <h5 className=" tracking-tight bg-gray-300 dark:bg-gray-700 text-gray-300 dark:text-gray-700 rounded-sm animate-pulse hidden lg:block text-nowrap leading-tight text-base font-semibold">
              {(dict.symptoms as I18nRecord).urgent_symptoms as string}
            </h5>
          </div>
          <div className="flex gap-3">
            <StatusCardSkeleton />
            <StatusCardSkeleton />
          </div>
        </CustomCard>
        <CustomCard>
          <div className="flex items-center gap-2">
            <div className="w-[35px] h-[35px] bg-gray-300 dark:bg-gray-700 rounded-md animate-pulse" />
            <h5 className=" tracking-tight bg-gray-300 dark:bg-gray-700 text-gray-300 dark:text-gray-700 rounded-sm animate-pulse hidden lg:block text-nowrap leading-tight text-base font-semibold">
              {(dict.symptoms as I18nRecord).urgent_symptoms as string}
            </h5>
          </div>
          <div className="flex gap-3">
            <StatusCardSkeleton />
            <StatusCardSkeleton />
          </div>
        </CustomCard>
        <CustomCard>
          <div className="flex items-center gap-2">
            <div className="w-[35px] h-[35px] bg-gray-300 dark:bg-gray-700 rounded-md animate-pulse" />
            <h5 className="tracking-tight bg-gray-300 dark:bg-gray-700 text-gray-300 dark:text-gray-700 rounded-sm animate-pulse hidden lg:block text-nowrap leading-tight text-base font-semibold">
              {(dict.symptoms as I18nRecord).urgent_symptoms as string}
            </h5>
          </div>
          <div className="flex gap-3">
            <StatusCardSkeleton />
            <StatusCardSkeleton />
          </div>
        </CustomCard>
      </div>
    </div>
  );
}
