"use client";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import CustomCard from "@/features/common/components/custom-card/custom-card";
import React from "react";
import SymptomIcon from "@/features/symptoms/components/symtom-icon";
import ConditionIcon from "@/features/symptoms/components/condition-icon";
import { useTreatmentsTrip } from "@/features/symptoms/hooks/use-treatments-trip";
import { TaskResponse } from "@/features/common/providers/alfresco-api/alfresco-api.types";

// Symptom data structure
interface SymptomData {
  id: string;
  key: string;
  icon: string;
  label: string;
  count: number;
  severity: number; // 0-4 severity levels
  conditions: string[];
}

function getSymptom(symptoms: any[], id: string) {
  return symptoms.filter((e) => e[id]);
}

function getTotalSymptoms(symptoms: any[], id: string) {
  const existingElement = getSymptom(symptoms, id);
  return existingElement.length > 0 ? existingElement[0][id].total_symptoms : 0;
}

function getConditions(symptoms: any[], id: string): string[] {
  const existingElement = getSymptom(symptoms, id);
  return existingElement.length > 0
    ? Object.keys(existingElement[0][id])
        .filter((e) => e !== "total_symptoms")
        .map((e: any) => e.toLowerCase())
    : [];
}

// Symptom card component
const SymptomCard = ({
  symptom,
  dict,
}: {
  symptom: SymptomData;
  dict: I18nRecord;
}) => {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-1 flex items-center gap-2">
      {/* First column: Icon and conditions */}
      <div className="flex flex-col items-center gap-1 min-w-0.5">
        <div className="text-gray-600">
          <SymptomIcon
            type={symptom.icon as string}
            size="h-6 w-6"
            dict={dict}
          />
        </div>
        <div className="flex gap-1">
          <div className="flex -space-x-2.5 transition-all duration-[0.5s] animate-show-flex">
            {Array.from(symptom.conditions).map((condition, index) => (
              <ConditionIcon
                key={index}
                condition={condition ?? ""}
                size="h-4 w-4"
                dict={dict}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Second column: Label */}
      <div className="flex-1 justify-center text-gray-900 text-xs font-light min-w-0">
        {/*  <span className="text-sm text-gray-700 font-light truncate block"> */}
        {symptom.label}
        {/* </span> */}
      </div>

      {/* Third column: Number */}
      <div className="text-l font-bold text-gray-800 flex-shrink-0">
        {symptom.count.toString().padStart(2, "0")}
      </div>
    </div>
  );
};

export default function SymptomsCard({
  dict,
  task,
}: {
  dict: I18nRecord;
  task: TaskResponse;
}) {
  const {
    treatmentsTripData: symptoms,
    isLoading,
    error,
  } = useTreatmentsTrip(task.mintral_serviceCode);
  if (error) {
    return <div>Error: {error.message}</div>;
  }
  if (isLoading) {
    return (
      <CustomCard
        title={
          (dict.bento as I18nRecord).symptoms_present_in_the_trip as string
        }
        subtitle={null}
      >
        <div className="bg-gray-200 animate-pulse rounded-lg h-20" />
      </CustomCard>
    );
  }

  if (symptoms && symptoms.length === 0) {
    return (
      <CustomCard
        title={
          (dict.bento as I18nRecord).symptoms_present_in_the_trip as string
        }
        subtitle={null}
      >
        <div className="grid grid-cols-2 gap-2 p-1">
          {(dict.symptoms as I18nRecord).no_symptoms as string}
        </div>
      </CustomCard>
    );
  }

  // Define all symptoms with their icons and default values
  const allSymptoms: SymptomData[] = [
    {
      key: "driver_change",
      icon: "DOUBLE DRIVER ROTATION CHECK",
      id: "Double Driver Rotation Check",
      label: (dict.symptoms as I18nRecord)
        .double_driver_rotation_check as string,
      count: getTotalSymptoms(symptoms, "Double Driver Rotation Check") || 0,
      severity: getTotalSymptoms(symptoms, "Double Driver Rotation Check") || 0,
      conditions: getConditions(symptoms, "Double Driver Rotation Check") || [
        "",
      ],
    },
    {
      key: "speed_limit",
      icon: "SPEED LIMIT STANDARD",
      id: "Speed Limit standard",
      label: (dict.symptoms as I18nRecord)["speed limit"] as string,
      count: getTotalSymptoms(symptoms, "Speed Limit Standard") || 0,
      severity: getTotalSymptoms(symptoms, "Speed Limit Standard") || 0,
      conditions: getConditions(symptoms, "Speed Limit Standard") || [""],
    },
    {
      key: "speed_limit_custom",
      icon: "SPEED LIMIT CUSTOM",
      id: "Speed Limit Custom",
      label: (dict.symptoms as I18nRecord)["Speed Limit Custom"] as string,
      count: getTotalSymptoms(symptoms, "Speed Limit Custom") || 0,
      severity: getTotalSymptoms(symptoms, "Speed Limit Custom") || 0,
      conditions: getConditions(symptoms, "Speed Limit Custom") || [""],
    },
    {
      key: "stay_risk",
      icon: "STAY RISK",
      id: "Stay Risk",
      label: (dict.symptoms as I18nRecord)["RISK ZONE STOP"] as string,
      count: getTotalSymptoms(symptoms, "Stay Risk") || 0,
      severity: getTotalSymptoms(symptoms, "Stay Risk") || 0,
      conditions: getConditions(symptoms, "Stay Risk") || [""],
    },
    {
      key: "night_stay_risk",
      icon: "NIGHT STAY RISK",
      id: "Night Stay Risk",
      label: (dict.symptoms as I18nRecord)["RISK ZONE SLEEP"] as string,
      count: getTotalSymptoms(symptoms, "Night Stay Risk") || 0,
      severity: getTotalSymptoms(symptoms, "Night Stay Risk") || 0,
      conditions: getConditions(symptoms, "Night Stay Risk") || [""],
    },
    {
      key: "off_hours_driving",
      icon: "OFF HOURS DRIVING",
      id: "Off Hours Driving",
      label: (dict.symptoms as I18nRecord)["OFF HOURS DRIVING"] as string,
      count: getTotalSymptoms(symptoms, "Off Hours Driving") || 0,
      severity: getTotalSymptoms(symptoms, "Off Hours Driving") || 0,
      conditions: getConditions(symptoms, "Off Hours Driving") || [""],
    },
    {
      key: "continuous_driving",
      icon: "CONTINUOUS DRIVE CHECK",
      id: "Continuous Drive Check",
      label: (dict.symptoms as I18nRecord)["CONTINUOUS DRIVE CHECK"] as string,
      count: getTotalSymptoms(symptoms, "Continuous Drive Check") || 0,
      severity: getTotalSymptoms(symptoms, "Continuous Drive Check") || 0,
      conditions: getConditions(symptoms, "Continuous Drive Check") || [""],
    },
    {
      key: "continuous_resting",
      icon: "CONTINUOUS RESTING CHECK",
      id: "Continuous Resting Check",
      label: (dict.symptoms as I18nRecord)[
        "CONTINUOUS RESTING CHECK"
      ] as string,
      count: getTotalSymptoms(symptoms, "Continuous Resting Check") || 0,
      severity: getTotalSymptoms(symptoms, "Continuous Resting Check") || 0,
      conditions: getConditions(symptoms, "Continuous Resting Check") || [""],
    },
    {
      key: "signal_loss",
      icon: "LOST SIGNAL",
      id: "Lost Signal",
      label: (dict.symptoms as I18nRecord)["LOST SIGNAL"] as string,
      count: getTotalSymptoms(symptoms, "Lost Signal") || 0,
      severity: getTotalSymptoms(symptoms, "Lost Signal") || 0,
      conditions: getConditions(symptoms, "Lost Signal") || [""],
    },
    {
      key: "deficient_cargo_securing",
      icon: "DEFICIENT CARGO SECURING",
      id: "Deficient Cargo Securing",
      label: (dict.symptoms as I18nRecord).deficient_cargo_securing as string,
      count: getTotalSymptoms(symptoms, "Deficient Cargo Securing") || 0,
      severity: getTotalSymptoms(symptoms, "Deficient Cargo Securing") || 0,
      conditions: getConditions(symptoms, "Deficient Cargo Securing") || [""],
    },
    {
      key: "absence_cargo_securing",
      icon: "NO CARGO SECURING",
      id: "No Cargo Securing",
      label: (dict.symptoms as I18nRecord).absence_cargo_securing as string,
      count: getTotalSymptoms(symptoms, "No Cargo Securing") || 0,
      severity: getTotalSymptoms(symptoms, "No Cargo Securing") || 0,
      conditions: getConditions(symptoms, "No Cargo Securing") || [""],
    },
    {
      key: "movement_with_cargo",
      icon: "MOVEMENT WITH CARGO",
      id: "Movement With Cargo",
      label: (dict.symptoms as I18nRecord).movement_with_cargo as string,
      count: getTotalSymptoms(symptoms, "Movement With Cargo") || 0,
      severity: getTotalSymptoms(symptoms, "Movement With Cargo") || 0,
      conditions: getConditions(symptoms, "Movement With Cargo") || [""],
    },
  ];

  return (
    <CustomCard
      title={
        (dict.bento as I18nRecord).conditions_present_in_the_trip as string
      }
      subtitle={null}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {allSymptoms
          .filter((e) => e.count > 0)
          .map((symptom) => (
            <SymptomCard key={symptom.key} symptom={symptom} dict={dict} />
          ))}
      </div>
    </CustomCard>
  );
}
