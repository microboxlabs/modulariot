import { I18nRecord } from "@/features/i18n/i18n.service.types";
import CustomCard from "@/features/common/components/custom-card/custom-card";
import React from "react";
import {
  FaExchangeAlt,
  FaTachometerAlt,
  FaExclamationTriangle,
  FaMoon,
  FaClock,
  FaRoute,
  FaBed,
  FaWifi,
  FaTruck,
  FaTimes,
  FaPlus,
} from "react-icons/fa";

// Symptom data structure
interface SymptomData {
  key: string;
  icon: React.ReactNode;
  label: string;
  count: number;
  severity: number; // 0-4 severity levels
}

// Symptom card component
const SymptomCard = ({ symptom }: { symptom: SymptomData }) => {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="text-gray-600 text-lg">{symptom.icon}</div>
          <span className="text-sm text-gray-700 font-medium">
            {symptom.label}
          </span>
        </div>
        <div className="text-2xl font-bold text-gray-800">
          {symptom.count.toString().padStart(2, "0")}
        </div>
      </div>
      <div className="flex gap-1">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className={`w-2 h-2 transform rotate-45 ${
              index < symptom.severity ? "bg-red-500" : "bg-gray-300"
            }`}
          />
        ))}
      </div>
    </div>
  );
};

export default function SymptomsCard({
  dict,
  symptoms = {},
  isLoading,
  error,
}: {
  dict: I18nRecord;
  symptoms: any;
  isLoading: boolean;
  error: Error | null;
}) {
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
        <div className="grid grid-cols-3 gap-3 p-4">
          {Array.from({ length: 12 }, (_, i) => (
            <div
              key={i}
              className="bg-gray-200 animate-pulse rounded-lg h-20"
            />
          ))}
        </div>
      </CustomCard>
    );
  }

  // Define all symptoms with their icons and default values
  const allSymptoms: SymptomData[] = [
    {
      key: "driver_change",
      icon: <FaExchangeAlt />,
      label: (dict.symptoms as I18nRecord).driver_change as string,
      count: symptoms.driver_change || 0,
      severity: symptoms.driver_change_severity || 0,
    },
    {
      key: "speed_limit",
      icon: <FaTachometerAlt />,
      label: (dict.symptoms as I18nRecord).speed_limit as string,
      count: symptoms.speed_limit || 0,
      severity: symptoms.speed_limit_severity || 0,
    },
    {
      key: "speed_limit_custom",
      icon: <FaTachometerAlt />,
      label: (dict.symptoms as I18nRecord).speed_limit_custom as string,
      count: symptoms.speed_limit_custom || 0,
      severity: symptoms.speed_limit_custom_severity || 0,
    },
    {
      key: "stay_risk",
      icon: <FaExclamationTriangle />,
      label: (dict.symptoms as I18nRecord).stay_risk as string,
      count: symptoms.stay_risk || 0,
      severity: symptoms.stay_risk_severity || 0,
    },
    {
      key: "night_stay_risk",
      icon: <FaMoon />,
      label: (dict.symptoms as I18nRecord).night_stay_risk as string,
      count: symptoms.night_stay_risk || 0,
      severity: symptoms.night_stay_risk_severity || 0,
    },
    {
      key: "off_hours_driving",
      icon: <FaClock />,
      label: (dict.symptoms as I18nRecord).off_hours_driving as string,
      count: symptoms.off_hours_driving || 0,
      severity: symptoms.off_hours_driving_severity || 0,
    },
    {
      key: "continuous_driving",
      icon: <FaRoute />,
      label: (dict.symptoms as I18nRecord).continuous_driving as string,
      count: symptoms.continuous_driving || 0,
      severity: symptoms.continuous_driving_severity || 0,
    },
    {
      key: "continuous_resting",
      icon: <FaBed />,
      label: (dict.symptoms as I18nRecord).continuous_resting as string,
      count: symptoms.continuous_resting || 0,
      severity: symptoms.continuous_resting_severity || 0,
    },
    {
      key: "signal_loss",
      icon: <FaWifi />,
      label: (dict.symptoms as I18nRecord).signal_loss as string,
      count: symptoms.signal_loss || 0,
      severity: symptoms.signal_loss_severity || 0,
    },
    {
      key: "deficient_cargo_securing",
      icon: <FaTruck />,
      label: (dict.symptoms as I18nRecord).deficient_cargo_securing as string,
      count: symptoms.deficient_cargo_securing || 0,
      severity: symptoms.deficient_cargo_securing_severity || 0,
    },
    {
      key: "absence_cargo_securing",
      icon: <FaTimes />,
      label: (dict.symptoms as I18nRecord).absence_cargo_securing as string,
      count: symptoms.absence_cargo_securing || 0,
      severity: symptoms.absence_cargo_securing_severity || 0,
    },
    {
      key: "movement_with_cargo",
      icon: <FaPlus />,
      label: (dict.symptoms as I18nRecord).movement_with_cargo as string,
      count: symptoms.movement_with_cargo || 0,
      severity: symptoms.movement_with_cargo_severity || 0,
    },
  ];

  return (
    <CustomCard
      title={
        (dict.bento as I18nRecord).conditions_present_in_the_trip as string
      }
      subtitle={null}
    >
      <div className="grid grid-cols-3 gap-3 p-4">
        {allSymptoms.map((symptom) => (
          <SymptomCard key={symptom.key} symptom={symptom} />
        ))}
      </div>
    </CustomCard>
  );
}
