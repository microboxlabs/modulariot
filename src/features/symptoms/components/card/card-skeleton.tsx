import ConditionIcon from "../condition-icon";
import StatusCard from "./status-card";
import CustomCard from "./custom-card";
import { I18nRecord } from "@/features/i18n/i18n.service.types";

export default function CardSkeleton({ dict }: { dict: I18nRecord }) {
  return (
    <div className="flex flex-col">
      <div className="relative pb-5 px-5 pt-10 flex flex-row md:flex-row gap-4 overflow-x-auto">
        <h1 className="absolute top-0 text-xl font-bold tracking-tight text-gray-900 dark:text-white">
          {(dict.symptoms as I18nRecord).symptoms as string}
        </h1>
        <CustomCard>
          <div className="flex items-center gap-2">
            <div className="w-[54px] h-[54px] bg-gray-300 dark:bg-gray-700 rounded-md animate-pulse" />
            <h5 className="text-2xl font-bold tracking-tight text-gray-300 hidden lg:block dark:text-gray-700 bg-gray-300 dark:bg-gray-700 rounded-md animate-pulse">
              {(dict.symptoms as I18nRecord).urgent_symptoms as string}
            </h5>
          </div>
          <div className="flex gap-3">
            <StatusCard
              dict={dict}
              icon={<ConditionIcon condition="code black" size="h-8 w-8" />}
              title={(dict.symptoms as I18nRecord).code_black as string}
              count="0"
              loading
            />
            <StatusCard
              dict={dict}
              icon={<ConditionIcon condition="critic" size="h-8 w-8" />}
              title={(dict.symptoms as I18nRecord).critical_condition as string}
              count="0"
              variant="critical"
              loading
            />
          </div>
        </CustomCard>
        <CustomCard>
          <div className="flex items-center gap-2">
            <div className="w-[54px] h-[54px] bg-gray-300 dark:bg-gray-700 rounded-md animate-pulse" />
            <h5 className="text-2xl font-bold tracking-tight hidden lg:block text-gray-300 dark:text-gray-700 bg-gray-300 dark:bg-gray-700 rounded-md animate-pulse">
              {(dict.symptoms as I18nRecord).urgent_symptoms as string}
            </h5>
          </div>
          <div className="flex gap-3">
            <StatusCard
              dict={dict}
              icon={<ConditionIcon condition="code black" size="h-8 w-8" />}
              title={(dict.symptoms as I18nRecord).code_black as string}
              count="0"
              loading
            />
            <StatusCard
              dict={dict}
              icon={<ConditionIcon condition="critic" size="h-8 w-8" />}
              title={(dict.symptoms as I18nRecord).critical_condition as string}
              count="0"
              variant="critical"
              loading
            />
          </div>
        </CustomCard>
        <CustomCard>
          <div className="flex items-center gap-2">
            <div className="w-[54px] h-[54px] bg-gray-300 dark:bg-gray-700 rounded-md animate-pulse" />
            <h5 className="text-2xl font-bold tracking-tight hidden lg:block text-gray-300 dark:text-gray-700 bg-gray-300 dark:bg-gray-700 rounded-md animate-pulse">
              {(dict.symptoms as I18nRecord).urgent_symptoms as string}
            </h5>
          </div>
          <div className="flex gap-3">
            <StatusCard
              dict={dict}
              icon={<ConditionIcon condition="code black" size="h-8 w-8" />}
              title={(dict.symptoms as I18nRecord).code_black as string}
              count="0"
              loading
            />
            <StatusCard
              dict={dict}
              icon={<ConditionIcon condition="critic" size="h-8 w-8" />}
              title={(dict.symptoms as I18nRecord).critical_condition as string}
              count="0"
              variant="critical"
              loading
            />
          </div>
        </CustomCard>
      </div>
    </div>
  );
}
