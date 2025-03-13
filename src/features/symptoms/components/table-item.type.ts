import blackCode from "@assets/conditions/codigo-negro.svg";
import criticalAlert from "@assets/conditions/alerta-critica.svg";
import recovery from "@assets/conditions/en-remision.svg";
import compromised from "@assets/conditions/comprometida.svg";
import observation from "@assets/conditions/en-observacion.svg";
import treatment from "@assets/conditions/en-tratamiento.svg";
import stable from "@assets/conditions/estable.svg";

export type TableItemType = {
  id: string;
  condition: string;
  licensePlate: string;
  time: string;
  trip: string;
  driver: string;
  date: string;
  service: string;
  alertType: string;
  status: string | null;
};

export type Condition = {
  dict_name: string;
  color: string;
  bgColor?: string;
  innerColor?: string;
  textColor: string;
  icon: string;
};

export const Conditions: Record<string, Condition> = {
  "code black": {
    dict_name: "code_black",
    color: "border-black",
    bgColor: "!bg-black",
    innerColor: "bg-gray-200",
    textColor: "text-white",
    icon: blackCode,
  },
  critic: {
    dict_name: "critical_condition",
    color: "border-red-500",
    bgColor: "!bg-rose-500",
    innerColor: "bg-rose-200",
    textColor: "text-white",
    icon: criticalAlert,
  },
  "critical condition": {
    dict_name: "critical_condition",
    color: "border-red-500",
    bgColor: "!bg-rose-500",
    innerColor: "bg-rose-200",
    textColor: "text-white",
    icon: criticalAlert,
  },
  treatment: {
    dict_name: "in_treatment",
    color: "border-amber-500",
    innerColor: "bg-amber-100",
    textColor: "text-black dark:text-white",
    bgColor: "",
    icon: treatment,
  },
  stable: {
    dict_name: "stable",
    color: "border-blue-600",
    innerColor: "bg-blue-100",
    textColor: "text-black dark:text-white",
    bgColor: "",
    icon: stable,
  },
  compromised: {
    dict_name: "compromised_condition",
    color: "border-rose-700",
    innerColor: "bg-rose-50",
    textColor: "text-black dark:text-white",
    bgColor: "",
    icon: compromised,
  },
  "compromised condition": {
    dict_name: "compromised_condition",
    color: "border-rose-700",
    innerColor: "bg-rose-50",
    textColor: "text-black dark:text-white",
    bgColor: "",
    icon: compromised,
  },
  "under observation": {
    dict_name: "in_observation",
    color: "border-rose-700",
    textColor: "text-black dark:text-white",
    innerColor: "bg-white",
    bgColor: "",
    icon: observation,
  },
  observation: {
    dict_name: "in_observation",
    color: "border-rose-700",
    textColor: "text-black dark:text-white",
    innerColor: "bg-white",
    bgColor: "",
    icon: observation,
  },
  remission: {
    dict_name: "in_remission",
    color: "border-teal-700",
    innerColor: "bg-teal-50",
    textColor: "text-black dark:text-white",
    bgColor: "",
    icon: recovery,
  },
};
