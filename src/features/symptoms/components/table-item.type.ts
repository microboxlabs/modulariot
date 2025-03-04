import codigoNegro from "@assets/conditions/codigo-negro.svg";
import alertaCritica from "@assets/conditions/alerta-critica.svg";
import enRemision from "@assets/conditions/en-remision.svg";
import comprometida from "@assets/conditions/comprometida.svg";
import enObservacion from "@assets/conditions/en-observacion.svg";
import enTratamiento from "@assets/conditions/en-tratamiento.svg";
import estable from "@assets/conditions/estable.svg";

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
    icon: codigoNegro,
  },
  critic: {
    color: "border-red-500",
    bgColor: "!bg-rose-500",
    innerColor: "bg-rose-200",
    textColor: "text-white",
    icon: alertaCritica,
  },
  "critical condition": {
    color: "border-red-500",
    bgColor: "!bg-rose-500",
    innerColor: "bg-rose-200",
    textColor: "text-white",
    icon: alertaCritica,
  },
  treatment: {
    color: "border-amber-500",
    innerColor: "bg-amber-100",
    textColor: "text-black dark:text-white",
    bgColor: "",
    icon: enTratamiento,
  },
  stable: {
    color: "border-blue-600",
    innerColor: "bg-blue-100",
    textColor: "text-black dark:text-white",
    bgColor: "",
    icon: estable,
  },
  compromised: {
    color: "border-rose-700",
    innerColor: "bg-rose-50",
    textColor: "text-black dark:text-white",
    bgColor: "",
    icon: comprometida,
  },
  "compromised condition": {
    color: "border-rose-700",
    innerColor: "bg-rose-50",
    textColor: "text-black dark:text-white",
    bgColor: "",
    icon: comprometida,
  },
  "under observation": {
    color: "border-rose-700",
    textColor: "text-black dark:text-white",
    innerColor: "bg-white",
    bgColor: "",
    icon: enObservacion,
  },
  observation: {
    color: "border-rose-700",
    textColor: "text-black dark:text-white",
    innerColor: "bg-white",
    bgColor: "",
    icon: enObservacion,
  },
  remission: {
    color: "border-teal-700",
    innerColor: "bg-teal-50",
    textColor: "text-black dark:text-white",
    bgColor: "",
    icon: enRemision,
  },
};
