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
  last_assigned_to: string | null;
};

export type Condition = {
  dict_name: string;
  color: string;
  bgColor?: string;
  hoverColor?: string;
  innerColor?: string;
  textColor: string;
  secundaryInteraction?: string;
  secundaryInteractionIcon?: string;
  separatorColor?: string;
  icon: string;
  borderColor?: string;
};

export const Conditions: Record<string, Condition> = {
  "code black": {
    dict_name: "code_black",
    color: "border-black",
    bgColor: "!bg-black",
    hoverColor: "hover:!bg-gray-900 dark:hover:!bg-gray-900",
    innerColor: "bg-gray-200",
    textColor: "text-white",
    secundaryInteraction: "border-gray-700 bg-gray-800 dark:bg-gray-800",
    secundaryInteractionIcon: "text-gray-200",
    separatorColor: "border-gray-700",
    icon: blackCode,
    borderColor: "border-gray-200 dark:border-gray-200",
  },
  critic: {
    dict_name: "critical_condition",
    color: "border-red-500",
    bgColor: "!bg-rose-500",
    hoverColor: "hover:!bg-rose-400 dark:hover:!bg-rose-400",
    innerColor: "bg-rose-200",
    textColor: "text-white",
    secundaryInteraction: "border-gray-700 bg-gray-800 dark:bg-gray-800",
    secundaryInteractionIcon: "text-gray-200",
    icon: criticalAlert,
    borderColor: "border-gray-200 dark:border-gray-200",
  },
  "critical condition": {
    dict_name: "critical_condition",
    color: "border-red-500",
    bgColor: "!bg-rose-500",
    hoverColor: "hover:!bg-rose-400 dark:hover:!bg-rose-400",
    innerColor: "bg-rose-200",
    textColor: "text-white",
    secundaryInteraction: "border-gray-300 bg-gray-100 dark:bg-gray-100",
    secundaryInteractionIcon: "text-gray-700",
    separatorColor: "border-gray-100",
    icon: criticalAlert,
    borderColor: "border-gray-200 dark:border-gray-200",
  },
  treatment: {
    dict_name: "in_treatment",
    color: "border-amber-500",
    innerColor: "bg-amber-100",
    textColor: "text-black dark:text-white",
    bgColor: "border border-gray-300 dark:border-gray-700",
    secundaryInteraction:
      "border-gray-400 dark:border-gray-600 bg-gray-100 dark:bg-gray-800",
    secundaryInteractionIcon: "text-gray-700 dark:text-gray-300",
    separatorColor: "border-gray-300 dark:border-gray-700",
    hoverColor: "",
    icon: treatment,
  },
  "under treatment": {
    dict_name: "in_treatment",
    color: "border-amber-500",
    innerColor: "bg-amber-100",
    textColor: "text-black dark:text-white",
    bgColor: "border border-gray-300 dark:border-gray-700",
    secundaryInteraction:
      "border-gray-400 dark:border-gray-600 bg-gray-100 dark:bg-gray-800",
    secundaryInteractionIcon: "text-gray-700 dark:text-gray-300",
    separatorColor: "border-gray-300 dark:border-gray-700",
    hoverColor: "",
    icon: treatment,
  },
  stable: {
    dict_name: "stable",
    color: "border-blue-600",
    innerColor: "bg-blue-100",
    textColor: "text-black dark:text-white",
    bgColor: "border border-gray-300 dark:border-gray-700",
    secundaryInteraction:
      "border-gray-400 dark:border-gray-600 bg-gray-100 dark:bg-gray-800",
    secundaryInteractionIcon: "text-gray-700 dark:text-gray-300",
    separatorColor: "border-gray-300 dark:border-gray-700",
    hoverColor: "",
    icon: stable,
  },
  compromised: {
    dict_name: "compromised_condition",
    color: "border-rose-700",
    innerColor: "bg-rose-50",
    textColor: "text-black dark:text-white",
    bgColor: "border border-gray-300 dark:border-gray-700",
    secundaryInteraction:
      "border-gray-400 dark:border-gray-600 bg-gray-100 dark:bg-gray-800",
    secundaryInteractionIcon: "text-gray-700 dark:text-gray-300",
    separatorColor: "border-gray-300 dark:border-gray-700",
    hoverColor: "",
    icon: compromised,
  },
  "compromised condition": {
    dict_name: "compromised_condition",
    color: "border-rose-700",
    innerColor: "bg-rose-50",
    textColor: "text-black dark:text-white",
    bgColor: "border border-gray-300 dark:border-gray-700",
    secundaryInteraction:
      "border-gray-400 dark:border-gray-600 bg-gray-100 dark:bg-gray-800",
    secundaryInteractionIcon: "text-gray-700 dark:text-gray-300",
    separatorColor: "border-gray-300 dark:border-gray-700",
    hoverColor: "",
    icon: compromised,
  },
  "under observation": {
    dict_name: "in_observation",
    color: "border-rose-700",
    textColor: "text-black dark:text-white",
    innerColor: "bg-white",
    bgColor: "border border-gray-300 dark:border-gray-700",
    secundaryInteraction:
      "border-gray-400 dark:border-gray-600 bg-gray-100 dark:bg-gray-800",
    secundaryInteractionIcon: "text-gray-700 dark:text-gray-300",
    separatorColor: "border-gray-300 dark:border-gray-700",
    hoverColor: "",
    icon: observation,
  },
  observation: {
    dict_name: "in_observation",
    color: "border-rose-700",
    textColor: "text-black dark:text-white",
    innerColor: "bg-white",
    bgColor: "border border-gray-300 dark:border-gray-700",
    secundaryInteraction:
      "border-gray-400 dark:border-gray-600 bg-gray-100 dark:bg-gray-800",
    secundaryInteractionIcon: "text-gray-700 dark:text-gray-300",
    separatorColor: "border-gray-300 dark:border-gray-700",
    hoverColor: "",
    icon: observation,
  },
  remission: {
    dict_name: "in_remission",
    color: "border-teal-700",
    innerColor: "bg-teal-50",
    textColor: "text-black dark:text-white",
    bgColor: "border border-gray-300 dark:border-gray-700",
    secundaryInteraction:
      "border-gray-400 dark:border-gray-600 bg-gray-100 dark:bg-gray-800",
    secundaryInteractionIcon: "text-gray-700 dark:text-gray-300",
    separatorColor: "border-gray-300 dark:border-gray-700",
    hoverColor: "",
    icon: recovery,
  },
};
