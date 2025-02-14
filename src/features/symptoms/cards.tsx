import { Card } from "flowbite-react";
import Image from "next/image";
import alarmImage from "@assets/images/alarm.gif";
import noAlarmImage from "@assets/images/no_alarm.gif";
import patchImage from "@assets/images/patch.gif";
import ConditionIcon from "./components/condition-icon";
import StatusCard from "./components/status-card";
import { useSymptoms } from "./hooks/use-symptoms";

export default function SymptomsCards({ showCards }: { showCards: boolean }) {
  const { symptoms, loading, error } = useSymptoms();

  // Handle loading and error states
  if (loading) {
    return <div className="p-4 text-center">Loading symptoms data...</div>;
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
  } = symptoms || {};

  return (
    <div
      className={`pt-2 px-5 flex flex-col gap-4 overflow-hidden transition-[max-height, padding] ease-in-out duration-300 
        ${showCards ? "max-h-[500px] pb-5" : "max-h-0 pb-0 "}
      `}
    >
      <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
        Síntomas
      </h1>
      <div className="flex flex-col md:flex-row gap-4">
        <Card
          className={`flex-1 ${showCards ? "animate-shadow-toggle" : ""}`}
          color="white"
        >
          <div className="flex items-center gap-2">
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
            <h5 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              Síntomas urgentes
            </h5>
          </div>
          <div className="flex gap-3">
            <StatusCard
              icon={<ConditionIcon condition="code black" size="h-8 w-8" />}
              title="Código negro"
              count={codeBlack.toString().padStart(2, "0")}
            />
            <StatusCard
              icon={<ConditionIcon condition="critic" size="h-8 w-8" />}
              title="Condición crítica"
              count={critic.toString().padStart(2, "0")}
              variant="critical"
            />
          </div>
        </Card>

        <Card className="flex-1" color="white">
          <div className="flex items-center gap-2">
            <Image
              className="w-[54px] h-[54px]"
              src={patchImage}
              alt="Síntomas Siendo tratados"
              width={54}
              height={54}
            />
            <h5 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              Síntomas siendo tratados
            </h5>
          </div>
          <div className="flex gap-3">
            <StatusCard
              icon={<ConditionIcon condition="treatment" size="h-8 w-8" />}
              title="Condición en tratamiento"
              count={treatment.toString().padStart(2, "0")}
            />
            <StatusCard
              icon={<ConditionIcon condition="observation" size="h-8 w-8" />}
              title="Condición en observación"
              count={observation.toString().padStart(2, "0")}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}
