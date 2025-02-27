import ConditionIcon from "../condition-icon";
import StatusCard from "./status-card";
import CustomCard from "./custom-card";

export default function CardSkeleton({ dict }: { dict: any }) {
  return (
    <div className="flex flex-col">
      <h1 className="px-5 text-xl font-bold tracking-tight text-gray-900 dark:text-white">
        {dict.symptoms.symptoms}
      </h1>
      <div className="p-5 flex flex-row md:flex-row gap-4 overflow-x-auto">
        <CustomCard>
          <div className="flex items-center gap-2">
            <div className="w-[54px] h-[54px] bg-gray-300 dark:bg-gray-700 rounded-md animate-pulse" />
            <h5 className="text-2xl font-bold tracking-tight text-gray-300 hidden lg:block dark:text-gray-700 bg-gray-300 dark:bg-gray-700 rounded-md animate-pulse">
              {dict.symptoms.urgent_symptoms}
            </h5>
          </div>
          <div className="flex gap-3">
            <StatusCard
              dict={dict}
              icon={<ConditionIcon condition="code black" size="h-8 w-8" />}
              title={dict.symptoms.code_black}
              count="0"
              loading
            />
            <StatusCard
              dict={dict}
              icon={<ConditionIcon condition="critic" size="h-8 w-8" />}
              title={dict.symptoms.critical_condition}
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
              {dict.symptoms.urgent_symptoms}
            </h5>
          </div>
          <div className="flex gap-3">
            <StatusCard
              dict={dict}
              icon={<ConditionIcon condition="code black" size="h-8 w-8" />}
              title={dict.symptoms.code_black}
              count="0"
              loading
            />
            <StatusCard
              dict={dict}
              icon={<ConditionIcon condition="critic" size="h-8 w-8" />}
              title={dict.symptoms.critical_condition}
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
              {dict.symptoms.urgent_symptoms}
            </h5>
          </div>
          <div className="flex gap-3">
            <StatusCard
              dict={dict}
              icon={<ConditionIcon condition="code black" size="h-8 w-8" />}
              title={dict.symptoms.code_black}
              count="0"
              loading
            />
            <StatusCard
              dict={dict}
              icon={<ConditionIcon condition="critic" size="h-8 w-8" />}
              title={dict.symptoms.critical_condition}
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
