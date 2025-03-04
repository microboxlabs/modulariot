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
  color: string;
  bgColor?: string;
  innerColor?: string;
  textColor: string;
  icon: string;
};

export const Conditions: Record<string, Condition> = {
  "code black": {
    color: "border-black",
    bgColor: "!bg-black",
    innerColor: "bg-gray-200",
    textColor: "text-white",
    icon: blackCode,
  },
  critic: {
    color: "border-red-500",
    bgColor: "!bg-rose-500",
    innerColor: "bg-rose-200",
    textColor: "text-white",
    icon: criticalAlert,
  },
  "critical condition": {
    color: "border-red-500",
    bgColor: "!bg-rose-500",
    innerColor: "bg-rose-200",
    textColor: "text-white",
    icon: criticalAlert,
  },
  treatment: {
    color: "border-amber-500",
    innerColor: "bg-amber-100",
    textColor: "text-black dark:text-white",
    bgColor: "!bg-gray-200",
    icon: treatment,
  },
  stable: {
    color: "border-blue-600",
    innerColor: "bg-blue-100",
    textColor: "text-black dark:text-white",
    bgColor: "!bg-gray-200",
    icon: stable,
  },
  compromised: {
    color: "border-rose-700",
    innerColor: "bg-rose-50",
    textColor: "text-black dark:text-white",
    bgColor: "!bg-gray-200",
    icon: compromised,
  },
  "compromised condition": {
    color: "border-rose-700",
    innerColor: "bg-rose-50",
    textColor: "text-black dark:text-white",
    bgColor: "!bg-gray-200",
    icon: compromised,
  },
  "under observation": {
    color: "border-rose-700",
    textColor: "text-black dark:text-white",
    innerColor: "bg-white",
    bgColor: "!bg-gray-200",
    icon: observation,
  },
  observation: {
    color: "border-rose-700",
    textColor: "text-black dark:text-white",
    innerColor: "bg-white",
    bgColor: "!bg-gray-200",
    icon: observation,
  },
  remission: {
    color: "border-teal-700",
    innerColor: "bg-teal-50",
    textColor: "text-black dark:text-white",
    bgColor: "!bg-gray-200",
    icon: recovery,
  },
};
