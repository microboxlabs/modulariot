import { Card } from "flowbite-react";
import Image from "next/image";
import alarmImage from "@assets/images/alarm.gif";
import patchImage from "@assets/images/patch.gif";

import React from "react";
import ConditionIcon from "./components/condition-icon";

interface StatusCardProps {
  icon: React.ReactNode;
  title: string;
  count: string;
  variant?: "black" | "critical";
}

function StatusCard({
  icon,
  title,
  count,
  variant = "black",
}: StatusCardProps) {
  const bgColor = variant === "critical" ? "bg-rose-100" : "bg-gray-200";
  const borderColor =
    variant === "critical" ? "border-rose-700" : "border-black";

  return (
    <div className="grow p-3 bg-white rounded-lg shadow-md border border-gray-200">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <div
            className={`w-6 h-6 ${bgColor} rounded-full border ${borderColor} flex items-center justify-center`}
          >
            <span className="text-white text-[8px] font-medium">{icon}</span>
          </div>
          <span className="text-[#111928] text-sm font-semibold">{title}</span>
        </div>
        <div className="flex items-end gap-2">
          <span className="text-gray-500 text-2xl font-semibold">{count}</span>
          <span className="text-gray-500 text-xs font-medium mb-1">
            Activos
          </span>
        </div>
      </div>
    </div>
  );
}

export default function SymptomsCards() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
        Síntomas
      </h1>
      <div className="flex flex-col md:flex-row gap-4">
        <Card className="flex-1" color="white">
          <div className="flex items-center gap-2">
            <Image
              className="w-[54px] h-[54px]"
              src={alarmImage}
              alt="Síntomas Urgentes"
              width={54}
              height={54}
            />
            <h5 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              Síntomas urgentes
            </h5>
          </div>
          <div className="flex gap-3">
            <StatusCard
              icon={<ConditionIcon condition="code black" size="h-8 w-8" />}
              title="Código negro"
              count="00"
            />
            <StatusCard
              icon={<ConditionIcon condition="critic" size="h-8 w-8" />}
              title="Condición crítica"
              count="05"
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
              count="22"
            />
            <StatusCard
              icon={<ConditionIcon condition="observation" size="h-8 w-8" />}
              title="Condición en observación"
              count="15"
            />
          </div>
        </Card>
      </div>
    </div>
  );
}
