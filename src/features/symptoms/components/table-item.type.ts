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
  tagColor: string;
  tagTextColor: string;
  secundaryInteraction?: string;
  secundaryInteractionIcon?: string;
  separatorColor?: string;
  icon: string;
};

export const Conditions: Record<string, Condition> = {
  "code black": {
    dict_name: "code_black",
    color: "border-black",
    bgColor: "!bg-black",
    innerColor: "bg-gray-200",
    textColor: "text-white",
    tagColor: "bg-gray-700 border-gray-600",
    tagTextColor: "text-gray-200",
    secundaryInteraction: "border-gray-700 bg-gray-800 dark:bg-gray-800",
    secundaryInteractionIcon: "text-gray-200",
    separatorColor: "border-gray-700",
    icon: blackCode,
  },
  critic: {
    dict_name: "critical_condition",
    color: "border-red-500",
    bgColor: "!bg-rose-500",
    innerColor: "bg-rose-200",
    textColor: "text-white",
    tagColor: "bg-red-200 border-red-700",
    tagTextColor: "text-red-200 dark:text-red-800",
    secundaryInteraction: "border-gray-700 bg-gray-800 dark:bg-gray-800",
    secundaryInteractionIcon: "text-gray-200",
    icon: criticalAlert,
  },
  "critical condition": {
    dict_name: "critical_condition",
    color: "border-red-500",
    bgColor: "!bg-rose-500",
    innerColor: "bg-rose-200",
    textColor: "text-white",
    tagColor: "bg-red-200 border-red-400",
    tagTextColor: "text-red-700 dark:text-red-700",
    secundaryInteraction: "border-gray-300 bg-gray-100 dark:bg-gray-100",
    secundaryInteractionIcon: "text-gray-700",
    separatorColor: "border-gray-100",
    icon: criticalAlert,
  },
  treatment: {
    dict_name: "in_treatment",
    color: "border-amber-500",
    innerColor: "bg-amber-100",
    textColor: "text-black dark:text-white",
    tagColor: "bg-gray-200 dark:bg-gray-700 border-gray-500",
    tagTextColor: "text-gray-800 dark:text-gray-200",
    bgColor: "border border-gray-300 dark:border-gray-700",
    secundaryInteraction:
      "border-gray-400 dark:border-gray-600 bg-gray-100 dark:bg-gray-800",
    secundaryInteractionIcon: "text-gray-700 dark:text-gray-300",
    separatorColor: "border-gray-300 dark:border-gray-700",
    icon: treatment,
  },
  stable: {
    dict_name: "stable",
    color: "border-blue-600",
    innerColor: "bg-blue-100",
    textColor: "text-black dark:text-white",
    tagColor: "bg-gray-200 dark:bg-gray-700 border-gray-500",
    tagTextColor: "text-gray-800 dark:text-gray-200",
    bgColor: "border border-gray-300 dark:border-gray-700",
    secundaryInteraction:
      "border-gray-400 dark:border-gray-600 bg-gray-100 dark:bg-gray-800",
    secundaryInteractionIcon: "text-gray-700 dark:text-gray-300",
    separatorColor: "border-gray-300 dark:border-gray-700",
    icon: stable,
  },
  compromised: {
    dict_name: "compromised_condition",
    color: "border-rose-700",
    innerColor: "bg-rose-50",
    textColor: "text-black dark:text-white",
    tagColor: "bg-gray-200 dark:bg-gray-700 border-gray-500",
    tagTextColor: "text-gray-800 dark:text-gray-200",
    bgColor: "border border-gray-300 dark:border-gray-700",
    secundaryInteraction:
      "border-gray-400 dark:border-gray-600 bg-gray-100 dark:bg-gray-800",
    secundaryInteractionIcon: "text-gray-700 dark:text-gray-300",
    separatorColor: "border-gray-300 dark:border-gray-700",
    icon: compromised,
  },
  "compromised condition": {
    dict_name: "compromised_condition",
    color: "border-rose-700",
    innerColor: "bg-rose-50",
    textColor: "text-black dark:text-white",
    tagColor: "bg-gray-200 dark:bg-gray-700 border-gray-500",
    tagTextColor: "text-gray-800 dark:text-gray-200",
    bgColor: "border border-gray-300 dark:border-gray-700",
    secundaryInteraction:
      "border-gray-400 dark:border-gray-600 bg-gray-100 dark:bg-gray-800",
    secundaryInteractionIcon: "text-gray-700 dark:text-gray-300",
    separatorColor: "border-gray-300 dark:border-gray-700",
    icon: compromised,
  },
  "under observation": {
    dict_name: "in_observation",
    color: "border-rose-700",
    textColor: "text-black dark:text-white",
    innerColor: "bg-white",
    tagColor: "bg-gray-200 dark:bg-gray-700 border-gray-500",
    tagTextColor: "text-gray-800 dark:text-gray-200",
    bgColor: "border border-gray-300 dark:border-gray-700",
    secundaryInteraction:
      "border-gray-400 dark:border-gray-600 bg-gray-100 dark:bg-gray-800",
    secundaryInteractionIcon: "text-gray-700 dark:text-gray-300",
    separatorColor: "border-gray-300 dark:border-gray-700",
    icon: observation,
  },
  observation: {
    dict_name: "in_observation",
    color: "border-rose-700",
    textColor: "text-black dark:text-white",
    innerColor: "bg-white",
    tagColor: "bg-gray-200 dark:bg-gray-700 border-gray-500",
    tagTextColor: "text-gray-800 dark:text-gray-200",
    bgColor: "border border-gray-300 dark:border-gray-700",
    secundaryInteraction:
      "border-gray-400 dark:border-gray-600 bg-gray-100 dark:bg-gray-800",
    secundaryInteractionIcon: "text-gray-700 dark:text-gray-300",
    separatorColor: "border-gray-300 dark:border-gray-700",
    icon: observation,
  },
  remission: {
    dict_name: "in_remission",
    color: "border-teal-700",
    innerColor: "bg-teal-50",
    textColor: "text-black dark:text-white",
    tagColor: "bg-gray-200 dark:bg-gray-700 border-gray-500",
    tagTextColor: "text-gray-800 dark:text-gray-200",
    bgColor: "border border-gray-300 dark:border-gray-700",
    secundaryInteraction:
      "border-gray-400 dark:border-gray-600 bg-gray-100 dark:bg-gray-800",
    secundaryInteractionIcon: "text-gray-700 dark:text-gray-300",
    separatorColor: "border-gray-300 dark:border-gray-700",
    icon: recovery,
  },
};
