import Image from "next/image";
import alarmImage from "@assets/images/alarm.gif";
import noAlarmImage from "@assets/images/no_alarm.gif";
import maskImage from "@assets/images/mask.gif";
import hospitalImage from "@assets/images/hospital.svg";
import patchImage from "@assets/images/patch.gif";
import ConditionIcon from "./components/condition-icon";
import StatusCard from "./components/card/status-card";
import CardSkeleton from "./components/card/card-skeleton";
import CustomCard from "./components/card/custom-card";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import icuConditions from "./model/icu_condition.json";
import { useSymptoms } from "../common/providers/client-api.provider";
import { useSearchParams } from "next/navigation";
import { Button } from "flowbite-react";
import { FaGear } from "react-icons/fa6";

export default function SymptomsCards({
  showCards,
  dict,
  settingsFunction,
}: {
  showCards: boolean;
  dict: I18nRecord;
  settingsFunction: () => void;
}) {
  const searchParams = useSearchParams();
  const date_range = {
    from: searchParams.get("date_from") || "",
    to: searchParams.get("date_to") || "",
  };

  const { symptoms, loading, error } = useSymptoms(date_range);

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
    //remission = 0,
    compromised = 0,
  } = symptoms || {};

  return (
    <div
      className={`relative w-full flex flex-col transition-all duration-300 ease-in-out
      ${showCards ? "max-h-[1000px] overflow-visible" : "max-h-0 overflow-hidden"}
      `}
    >
      <div className="w-full flex flex-row justify-between">
        <h1 className="ml-5 text-xl font-bold tracking-tight text-gray-900 dark:text-white leading-tight flex items-center">
          {(dict.symptoms as I18nRecord).symptoms as string}
        </h1>
        <Button
          color="alternative"
          className="mr-5 h-10 w-10 p-0"
          onClick={settingsFunction}
        >
          <FaGear className="h-4 w-4 border-blue-500" />
        </Button>
      </div>

      <div className="relative pb-3 px-5 pt-2 flex flex-row md:flex-row gap-4 overflow-x-auto">
        <CustomCard
          className={`${showCards && (codeBlack > 0 || critic > 0) && !date_range.from && !date_range.to ? "animate-shadow-toggle" : ""}`}
        >
          <div className="flex items-center gap-2">
            <div className="h-[35px] w-[35px]">
              {codeBlack > 0 ? (
                <Image
                  className="w-[35px] h-[35px]"
                  src={alarmImage}
                  alt="Síntomas Urgentes"
                  width={35}
                  height={35}
                />
              ) : (
                <Image
                  className="w-[35px] h-[35px]"
                  src={noAlarmImage}
                  alt="Síntomas Urgentes"
                  width={35}
                  height={35}
                />
              )}
            </div>
            <h5 className="tracking-tight text-gray-900 dark:text-white hidden lg:block text-nowrap leading-tight text-base font-semibold">
              {(dict.symptoms as I18nRecord).urgent_symptoms as string}
            </h5>
          </div>
          <div className="flex gap-3 w-full">
            <StatusCard
              dict={dict}
              icon={
                <ConditionIcon
                  condition="code black"
                  size="h-7 w-7"
                  dict={dict}
                />
              }
              title={(dict.symptoms as I18nRecord).code_black as string}
              icu_condition={icuConditions.code_black}
              count={codeBlack.toString().padStart(2, "0")}
            />
          </div>
        </CustomCard>
        <CustomCard>
          <div className="flex items-center gap-2">
            <div className="h-[35px] w-[35px]">
              <Image
                className="w-[35px] h-[35px]"
                src={hospitalImage}
                alt="Síntomas críticos"
                width={35}
                height={35}
              />
            </div>
            <h5 className="tracking-tight text-gray-900 dark:text-white hidden lg:block text-nowrap leading-tight text-base font-semibold">
              {(dict.symptoms as I18nRecord).critical_symptoms as string}
            </h5>
          </div>
          <div className="flex gap-3">
            <StatusCard
              dict={dict}
              icon={
                <ConditionIcon condition="critic" size="h-7 w-7" dict={dict} />
              }
              title={(dict.symptoms as I18nRecord).critical_condition as string}
              icu_condition={icuConditions.critical_condition}
              count={critic.toString().padStart(2, "0")}
              variant="critical"
            />

            <StatusCard
              dict={dict}
              icon={
                <ConditionIcon
                  condition="compromised"
                  size="h-7 w-7"
                  dict={dict}
                />
              }
              title={
                (dict.symptoms as I18nRecord).compromised_condition as string
              }
              icu_condition={icuConditions.compromised_condition}
              count={compromised.toString().padStart(2, "0")}
              variant="critical"
            />
          </div>
        </CustomCard>
        <CustomCard>
          <div className="flex items-center gap-2">
            <div className="h-[35px] w-[35px]">
              <Image
                className="w-[35px] h-[35px]"
                src={maskImage}
                alt="Síntomas Siendo tratados"
                width={35}
                height={35}
              />
            </div>
            <h5 className="tracking-tight text-gray-900 dark:text-white hidden lg:block text-nowrap leading-tight text-base font-semibold">
              {(dict.symptoms as I18nRecord).under_treatment as string}
            </h5>
          </div>
          <div className="flex gap-3">
            <StatusCard
              dict={dict}
              icon={
                <ConditionIcon
                  condition="under observation"
                  size="h-7 w-7"
                  dict={dict}
                />
              }
              title={(dict.symptoms as I18nRecord).in_observation as string}
              icu_condition={icuConditions.under_observation}
              count={observation.toString().padStart(2, "0")}
            />
            <StatusCard
              dict={dict}
              icon={
                <ConditionIcon
                  condition="treatment"
                  size="h-7 w-7"
                  dict={dict}
                />
              }
              title={(dict.symptoms as I18nRecord).in_treatment as string}
              icu_condition={icuConditions.under_treatment}
              count={treatment.toString().padStart(2, "0")}
            />
          </div>
        </CustomCard>
      </div>
    </div>
  );
}
