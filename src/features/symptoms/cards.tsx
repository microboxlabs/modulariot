import Image from "next/image";
import alarmImage from "@assets/images/alarm.gif";
import noAlarmImage from "@assets/images/no_alarm.gif";
import maskImage from "@assets/images/mask.gif";
import patchImage from "@assets/images/patch.gif";
import ConditionIcon from "./components/condition-icon";
import StatusCard from "./components/card/status-card";
import CardSkeleton from "./components/card/card-skeleton";
import CustomCard from "./components/card/custom-card";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import icuConditions from "./model/icu_condition.json";
import { useSymptoms } from "../common/providers/client-api.provider";

export default function SymptomsCards({
  showCards,
  dict,
}: {
  showCards: boolean;
  dict: I18nRecord;
}) {
  const { symptoms, loading, error } = useSymptoms();

  // Handle loading and error states
  if (loading) {
    return <CardSkeleton dict={dict} />;
  }

  if (error) {
    //Todo: Show error message
  }

  // Default values in case symptoms is null
  const {
    codeBlack = 0,
    critic = 0,
    treatment = 0,
    observation = 0,
    stable = 0,
    remission = 0,
    //compromised = 0,
  } = symptoms || {};

  return (
    <div
      className={`w-full flex flex-col transition-all duration-300 ease-in-out
      ${showCards ? "max-h-[1000px] overflow-visible" : "max-h-0 overflow-hidden"}
      `}
    >
      <div className="relative pb-5 px-5 pt-10 flex flex-row md:flex-row gap-4 overflow-x-auto">
        <h1 className="absolute top-0 text-xl font-bold tracking-tight text-gray-900 dark:text-white">
          {(dict.symptoms as I18nRecord).symptoms as string}
        </h1>
        <CustomCard className={`${showCards ? "animate-shadow-toggle" : ""}`}>
          <div className="flex items-center gap-2">
            <div className="h-[54px] w-[54px]">
              {codeBlack > 0 ? (
                <Image
                  className="w-[54px] h-[54px]"
                  src={alarmImage}
                  alt="Síntomas Urgentes"
                  width={54}
                  height={54}
                />
              ) : (
                <Image
                  className="w-[54px] h-[54px]"
                  src={noAlarmImage}
                  alt="Síntomas Urgentes"
                  width={54}
                  height={54}
                />
              )}
            </div>
            <h5 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-white hidden lg:block">
              {(dict.symptoms as I18nRecord).urgent_symptoms as string}
            </h5>
          </div>
          <div className="flex gap-3">
            <StatusCard
              dict={dict}
              icon={<ConditionIcon condition="code black" size="h-8 w-8" />}
              title={(dict.symptoms as I18nRecord).code_black as string}
              icu_condition={icuConditions.code_black}
              count={codeBlack.toString().padStart(2, "0")}
            />

            <StatusCard
              dict={dict}
              icon={<ConditionIcon condition="critic" size="h-8 w-8" />}
              title={(dict.symptoms as I18nRecord).critical_condition as string}
              icu_condition={icuConditions.critical_condition}
              count={critic.toString().padStart(2, "0")}
              variant="critical"
            />
          </div>
        </CustomCard>
        <CustomCard>
          <div className="flex items-center gap-2">
            <div className="h-[54px] w-[54px]">
              <Image
                className="w-[54px] h-[54px]"
                src={maskImage}
                alt="Síntomas Siendo tratados"
                width={54}
                height={54}
              />
            </div>
            <h5 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-white hidden lg:block">
              {(dict.symptoms as I18nRecord).under_treatment as string}
            </h5>
          </div>
          <div className="flex gap-3">
            <StatusCard
              dict={dict}
              icon={<ConditionIcon condition="treatment" size="h-8 w-8" />}
              title={(dict.symptoms as I18nRecord).in_treatment as string}
              icu_condition={icuConditions.under_treatment}
              count={treatment.toString().padStart(2, "0")}
            />
            <StatusCard
              dict={dict}
              icon={<ConditionIcon condition="observation" size="h-8 w-8" />}
              title={(dict.symptoms as I18nRecord).in_observation as string}
              icu_condition={icuConditions.under_observation}
              count={observation.toString().padStart(2, "0")}
            />
          </div>
        </CustomCard>
        <CustomCard>
          <div className="flex items-center gap-2">
            <div className="h-[54px] w-[54px]">
              <Image
                className="w-[54px] h-[54px]"
                src={patchImage}
                alt="Síntomas Siendo tratados"
                width={54}
                height={54}
              />
            </div>
            <h5 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-white hidden lg:block">
              {(dict.symptoms as I18nRecord).restablished_symptoms as string}
            </h5>
          </div>
          <div className="flex gap-3">
            <StatusCard
              dict={dict}
              icon={<ConditionIcon condition="remission" size="h-8 w-8" />}
              title={(dict.symptoms as I18nRecord).in_remission as string}
              icu_condition={icuConditions.remission_state}
              count={remission.toString().padStart(2, "0")}
            />
            <StatusCard
              dict={dict}
              icon={<ConditionIcon condition="stable" size="h-8 w-8" />}
              title={(dict.symptoms as I18nRecord).stable as string}
              icu_condition={icuConditions.stable}
              count={stable.toString().padStart(2, "0")}
            />
          </div>
        </CustomCard>
      </div>
    </div>
  );
}
