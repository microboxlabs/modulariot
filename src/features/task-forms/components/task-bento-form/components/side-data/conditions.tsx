"use client";

import ConditionIcon from "@/features/symptoms/components/condition-icon";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import CustomCard from "@/features/common/components/custom-card/custom-card";
import useGetConditions from "../../hooks/use-get-conditions";
import { TaskResponse } from "@/features/common/providers/alfresco-api/alfresco-api.types";

export default function Conditions({
  dict,
  task,
}: {
  dict: I18nRecord;
  task: TaskResponse;
}) {
  const { data: conditions, isLoading: isLoadingConditions } = useGetConditions(
    task.id,
  );

  if (isLoadingConditions) {
    return <div className="w-full h-full bg-gray-500 animate-pulse"></div>;
  }

  return (
    <CustomCard
      title={(dict.bento as I18nRecord).symptoms_present_in_the_trip as string}
      subtitle={null}
    >
      <div className="flex flex-col justify-between w-full h-full">
        <div className="flex flex-col gap-2 w-full flex-grow justify-center items-center mb-2">
          {/* Code black */}
          <div className="p-2 w-full flex flex-row gap-2 justify-between items-center border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1">
            <div className="flex flex-row gap-2 items-center w-full">
              <ConditionIcon
                condition="code black"
                size="h-7 w-7"
                dict={dict as unknown as I18nRecord}
              />
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {(dict.symptoms as I18nRecord).code_black as string}
              </p>
            </div>
            <h1 className="text-md text-gray-800 dark:text-gray-200 h-full flex items-center justify-center">
              {conditions["Code Black"] || 0}
            </h1>
          </div>
          {/* Critical condition */}
          <div className="w-full flex flex-row gap-2 justify-between items-center border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1">
            <div className="flex flex-row gap-2 items-center w-full">
              <ConditionIcon
                condition="critic"
                size="h-7 w-7"
                dict={dict as unknown as I18nRecord}
              />
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {(dict.symptoms as I18nRecord).critical_condition as string}
              </p>
            </div>
            <h1 className="text-md text-gray-800 dark:text-gray-200 h-full flex items-center justify-center">
              {conditions["Critical condition"] || 0}
            </h1>
          </div>
          <div className="w-full flex flex-row gap-2 justify-between items-center border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1">
            <div className="flex flex-row gap-2 items-center w-full">
              <ConditionIcon
                condition="compromised"
                size="h-7 w-7"
                dict={dict as unknown as I18nRecord}
              />
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {(dict.symptoms as I18nRecord).compromised_condition as string}
              </p>
            </div>
            <h1 className="text-md text-gray-800 dark:text-gray-200 h-full flex items-center justify-center">
              {conditions["Compromised condition"] || 0}
            </h1>
          </div>
          {/* Treatment and observation */}
          <div className="w-full flex flex-row gap-2 justify-between items-center border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1">
            <div className="flex flex-row gap-2 items-center w-full">
              <ConditionIcon
                condition="treatment"
                size="h-7 w-7"
                dict={dict as unknown as I18nRecord}
              />
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {(dict.symptoms as I18nRecord).in_treatment as string}
              </p>
            </div>
            <h1 className="text-md text-gray-800 dark:text-gray-200 h-full flex items-center justify-center">
              {conditions["Under Treatment"] || 0}
            </h1>
          </div>
          <div className="w-full flex flex-row gap-2 justify-between items-center border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1">
            <div className="flex flex-row gap-2 items-center w-full">
              <ConditionIcon
                condition="observation"
                size="h-7 w-7"
                dict={dict as unknown as I18nRecord}
              />
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {(dict.symptoms as I18nRecord).in_observation as string}
              </p>
            </div>
            <h1 className="text-md text-gray-800 dark:text-gray-200 h-full flex items-center justify-center">
              {conditions["Under Observation"] || 0}
            </h1>
          </div>
        </div>
        <h2 className="text-sm text-gray-800 dark:text-gray-200 font-light">
          {(dict.bento as I18nRecord).totals as string}:{" "}
          <span className="font-bold">{conditions["total_symptoms"] || 0}</span>{" "}
          {(dict.bento as I18nRecord).detected_conditions as string} /{" "}
          <span className="font-bold">
            {conditions["total_successfully_treated"] || 0}
          </span>{" "}
          {(dict.bento as I18nRecord).successfully_treated as string}
        </h2>
      </div>
    </CustomCard>
  );
}
