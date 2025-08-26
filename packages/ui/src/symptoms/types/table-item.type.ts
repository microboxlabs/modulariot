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
    hoverColor: "hover:!bg-slate-900 dark:hover:!bg-slate-900",
    innerColor: "bg-slate-200",
    textColor: "text-white",
    secundaryInteraction: "border-slate-700 bg-slate-800 dark:bg-slate-800",
    secundaryInteractionIcon: "text-slate-200",
    separatorColor: "border-slate-700",
    icon: "/icons/conditions/codigo-negro.svg",
    borderColor: "border-slate-200 dark:border-slate-200",
  },
  critic: {
    dict_name: "critical_condition",
    color: "border-red-500",
    bgColor: "!bg-rose-500",
    hoverColor: "hover:!bg-rose-400 dark:hover:!bg-rose-400",
    innerColor: "bg-rose-200",
    textColor: "text-white",
    secundaryInteraction: "border-slate-700 bg-slate-800 dark:bg-slate-800",
    secundaryInteractionIcon: "text-slate-200",
    icon: "/icons/conditions/alerta-critica.svg",
    borderColor: "border-slate-200 dark:border-slate-200",
  },
  "critical condition": {
    dict_name: "critical_condition",
    color: "border-red-500",
    bgColor: "!bg-rose-500",
    hoverColor: "hover:!bg-rose-400 dark:hover:!bg-rose-400",
    innerColor: "bg-rose-200",
    textColor: "text-white",
    secundaryInteraction: "border-slate-300 bg-slate-100 dark:bg-slate-100",
    secundaryInteractionIcon: "text-slate-700",
    separatorColor: "border-slate-100",
    icon: "/icons/conditions/alerta-critica.svg",
    borderColor: "border-slate-200 dark:border-slate-200",
  },
  treatment: {
    dict_name: "in_treatment",
    color: "border-amber-500",
    innerColor: "bg-amber-100",
    textColor: "text-black dark:text-white",
    bgColor: "border border-slate-300 dark:border-slate-700",
    secundaryInteraction:
      "border-slate-400 dark:border-slate-600 bg-slate-100 dark:bg-slate-800",
    secundaryInteractionIcon: "text-slate-700 dark:text-slate-300",
    separatorColor: "border-slate-300 dark:border-slate-700",
    hoverColor: "",
    icon: "/icons/conditions/en-tratamiento.svg",
  },
  "under treatment": {
    dict_name: "in_treatment",
    color: "border-amber-500",
    innerColor: "bg-amber-100",
    textColor: "text-black dark:text-white",
    bgColor: "border border-slate-300 dark:border-slate-700",
    secundaryInteraction:
      "border-slate-400 dark:border-slate-600 bg-slate-100 dark:bg-slate-800",
    secundaryInteractionIcon: "text-slate-700 dark:text-slate-300",
    separatorColor: "border-slate-300 dark:border-slate-700",
    hoverColor: "",
    icon: "/icons/conditions/en-tratamiento.svg",
  },
  stable: {
    dict_name: "stable",
    color: "border-blue-600",
    innerColor: "bg-blue-100",
    textColor: "text-black dark:text-white",
    bgColor: "border border-slate-300 dark:border-slate-700",
    secundaryInteraction:
      "border-slate-400 dark:border-slate-600 bg-slate-100 dark:bg-slate-800",
    secundaryInteractionIcon: "text-slate-700 dark:text-slate-300",
    separatorColor: "border-slate-300 dark:border-slate-700",
    hoverColor: "",
    icon: "/icons/conditions/estable.svg",
  },
  compromised: {
    dict_name: "compromised_condition",
    color: "border-rose-700",
    innerColor: "bg-rose-50",
    textColor: "text-black dark:text-white",
    bgColor: "border border-slate-300 dark:border-slate-700",
    secundaryInteraction:
      "border-slate-400 dark:border-slate-600 bg-slate-100 dark:bg-slate-800",
    secundaryInteractionIcon: "text-slate-700 dark:text-slate-300",
    separatorColor: "border-slate-300 dark:border-slate-700",
    hoverColor: "",
    icon: "/icons/conditions/comprometida.svg",
  },
  "compromised condition": {
    dict_name: "compromised_condition",
    color: "border-rose-700",
    innerColor: "bg-rose-50",
    textColor: "text-black dark:text-white",
    bgColor: "border border-slate-300 dark:border-slate-700",
    secundaryInteraction:
      "border-slate-400 dark:border-slate-600 bg-slate-100 dark:bg-slate-800",
    secundaryInteractionIcon: "text-slate-700 dark:text-slate-300",
    separatorColor: "border-slate-300 dark:border-slate-700",
    hoverColor: "",
    icon: "/icons/conditions/comprometida.svg",
  },
  "under observation": {
    dict_name: "in_observation",
    color: "border-rose-700",
    textColor: "text-black dark:text-white",
    innerColor: "bg-white",
    bgColor: "border border-slate-300 dark:border-slate-700",
    secundaryInteraction:
      "border-slate-400 dark:border-slate-600 bg-slate-100 dark:bg-slate-800",
    secundaryInteractionIcon: "text-slate-700 dark:text-slate-300",
    separatorColor: "border-slate-300 dark:border-slate-700",
    hoverColor: "",
    icon: "/icons/conditions/en-observacion.svg",
  },
  observation: {
    dict_name: "in_observation",
    color: "border-rose-700",
    textColor: "text-black dark:text-white",
    innerColor: "bg-white",
    bgColor: "border border-slate-300 dark:border-slate-700",
    secundaryInteraction:
      "border-slate-400 dark:border-slate-600 bg-slate-100 dark:bg-slate-800",
    secundaryInteractionIcon: "text-slate-700 dark:text-slate-300",
    separatorColor: "border-slate-300 dark:border-slate-700",
    hoverColor: "",
    icon: "/icons/conditions/en-observacion.svg",
  },
  remission: {
    dict_name: "in_remission",
    color: "border-teal-700",
    innerColor: "bg-teal-50",
    textColor: "text-black dark:text-white",
    bgColor: "border border-slate-300 dark:border-slate-700",
    secundaryInteraction:
      "border-slate-400 dark:border-slate-600 bg-slate-100 dark:bg-slate-800",
    secundaryInteractionIcon: "text-slate-700 dark:text-slate-300",
    separatorColor: "border-slate-300 dark:border-slate-700",
    hoverColor: "",
    icon: "/icons/conditions/en-remision.svg",
  },
  "ignore condition": {
    dict_name: "in_remission",
    color: "border-teal-700",
    innerColor: "bg-teal-50",
    textColor: "text-black dark:text-white",
    bgColor: "border border-slate-300 dark:border-slate-700",
    secundaryInteraction:
      "border-slate-400 dark:border-slate-600 bg-slate-100 dark:bg-slate-800",
    secundaryInteractionIcon: "text-slate-700 dark:text-slate-300",
    separatorColor: "border-slate-300 dark:border-slate-700",
    hoverColor: "",
    icon: "/icons/conditions/en-remision.svg",
  },
};

export const Symptoms: Record<string, SymptomType> = {
  "CONTINUOUS RESTING CHECK": {
    dict_name: "code_black",
    color: "border-black",
    bgColor: "!bg-black",
    hoverColor: "hover:!bg-slate-900 dark:hover:!bg-slate-900",
    innerColor: "bg-slate-200",
    textColor: "text-white",
    secundaryInteraction: "border-slate-700 bg-slate-800 dark:bg-slate-800",
    secundaryInteractionIcon: "text-slate-200",
    separatorColor: "border-slate-700",
    icon: "/icons/timeline/continuous-resting-check.svg",
    borderColor: "border-slate-200 dark:border-slate-200",
  },
  "LOST SIGNAL": {
    dict_name: "critical_condition",
    color: "border-red-500",
    bgColor: "!bg-rose-500",
    hoverColor: "hover:!bg-rose-400 dark:hover:!bg-rose-400",
    innerColor: "bg-rose-200",
    textColor: "text-white",
    secundaryInteraction: "border-slate-700 bg-slate-800 dark:bg-slate-800",
    secundaryInteractionIcon: "text-slate-200",
    icon: "/icons/timeline/lost-signal.svg",
    borderColor: "border-slate-200 dark:border-slate-200",
  },
  "SPEED LIMIT STANDARD": {
    dict_name: "critical_condition",
    color: "border-red-500",
    bgColor: "!bg-rose-500",
    hoverColor: "hover:!bg-rose-400 dark:hover:!bg-rose-400",
    innerColor: "bg-rose-200",
    textColor: "text-white",
    secundaryInteraction: "border-slate-300 bg-slate-100 dark:bg-slate-100",
    secundaryInteractionIcon: "text-slate-700",
    separatorColor: "border-slate-100",
    icon: "/icons/timeline/speed-limit-standar.svg",
    borderColor: "border-slate-200 dark:border-slate-200",
  },
  "SPEED LIMIT CUSTOM": {
    dict_name: "in_treatment",
    color: "border-amber-500",
    innerColor: "bg-amber-100",
    textColor: "text-black dark:text-white",
    bgColor: "border border-slate-300 dark:border-slate-700",
    secundaryInteraction:
      "border-slate-400 dark:border-slate-600 bg-slate-100 dark:bg-slate-800",
    secundaryInteractionIcon: "text-slate-700 dark:text-slate-300",
    separatorColor: "border-slate-300 dark:border-slate-700",
    hoverColor: "",
    icon: "/icons/timeline/speed-limit-custom.svg",
  },
  "CONTINUOUS DRIVE CHECK": {
    dict_name: "in_treatment",
    color: "border-amber-500",
    innerColor: "bg-amber-100",
    textColor: "text-black dark:text-white",
    bgColor: "border border-slate-300 dark:border-slate-700",
    secundaryInteraction:
      "border-slate-400 dark:border-slate-600 bg-slate-100 dark:bg-slate-800",
    secundaryInteractionIcon: "text-slate-700 dark:text-slate-300",
    separatorColor: "border-slate-300 dark:border-slate-700",
    hoverColor: "",
    icon: "/icons/timeline/continuos-drive-check.svg",
  },
  "DOUBLE DRIVER ROTATION CHECK": {
    dict_name: "in_treatment",
    color: "border-amber-500",
    innerColor: "bg-amber-100",
    textColor: "text-black dark:text-white",
    bgColor: "border border-slate-300 dark:border-slate-700",
    secundaryInteraction:
      "border-slate-400 dark:border-slate-600 bg-slate-100 dark:bg-slate-800",
    secundaryInteractionIcon: "text-slate-700 dark:text-slate-300",
    separatorColor: "border-slate-300 dark:border-slate-700",
    hoverColor: "",
    icon: "/icons/timeline/double-driver-rotation-check.svg",
  },
  "OFF HOURS DRIVING": {
    dict_name: "stable",
    color: "border-blue-600",
    innerColor: "bg-blue-100",
    textColor: "text-black dark:text-white",
    bgColor: "border border-slate-300 dark:border-slate-700",
    secundaryInteraction:
      "border-slate-400 dark:border-slate-600 bg-slate-100 dark:bg-slate-800",
    secundaryInteractionIcon: "text-slate-700 dark:text-slate-300",
    separatorColor: "border-slate-300 dark:border-slate-700",
    hoverColor: "",
    icon: "/icons/timeline/off-hour-driving.svg",
  },
  "NIGHT STAY RISK": {
    dict_name: "night_stay_risk",
    color: "border-blue-600",
    innerColor: "bg-blue-100",
    textColor: "text-black dark:text-white",
    bgColor: "border border-slate-300 dark:border-slate-700",
    secundaryInteraction:
      "border-slate-400 dark:border-slate-600 bg-slate-100 dark:bg-slate-800",
    secundaryInteractionIcon: "text-slate-700 dark:text-slate-300",
    separatorColor: "border-slate-300 dark:border-slate-700",
    hoverColor: "",
    icon: "/icons/timeline/overnight-risk-stay.svg",
  },
  "STAY RISK": {
    dict_name: "stay_risk",
    color: "border-blue-600",
    innerColor: "bg-blue-100",
    textColor: "text-black dark:text-white",
    bgColor: "border border-slate-300 dark:border-slate-700",
    secundaryInteraction:
      "border-slate-400 dark:border-slate-600 bg-slate-100 dark:bg-slate-800",
    secundaryInteractionIcon: "text-slate-700 dark:text-slate-300",
    separatorColor: "border-slate-300 dark:border-slate-700",
    hoverColor: "",
    icon: "/icons/timeline/risk-stay.svg",
  },
  "DEFICIENT CARGO SECURING": {
    dict_name: "deficient_cargo_securing",
    color: "border-blue-600",
    innerColor: "bg-blue-100",
    textColor: "text-black dark:text-white",
    bgColor: "border border-slate-300 dark:border-slate-700",
    secundaryInteraction:
      "border-slate-400 dark:border-slate-600 bg-slate-100 dark:bg-slate-800",
    secundaryInteractionIcon: "text-slate-700 dark:text-slate-300",
    separatorColor: "border-slate-300 dark:border-slate-700",
    hoverColor: "",
    icon: "/icons/timeline/deficient-cargo-securing.svg",
  },
  "NO CARGO SECURING": {
    dict_name: "absence_cargo_securing",
    color: "border-blue-600",
    innerColor: "bg-blue-100",
    textColor: "text-black dark:text-white",
    bgColor: "border border-slate-300 dark:border-slate-700",
    secundaryInteraction:
      "border-slate-400 dark:border-slate-600 bg-slate-100 dark:bg-slate-800",
    secundaryInteractionIcon: "text-slate-700 dark:text-slate-300",
    separatorColor: "border-slate-300 dark:border-slate-700",
    hoverColor: "",
    icon: "/icons/timeline/absence-cargo-securing.svg",
  },
  "MOVEMENT WITH CARGO": {
    dict_name: "movement_with_cargo",
    color: "border-blue-600",
    innerColor: "bg-blue-100",
    textColor: "text-black dark:text-white",
    bgColor: "border border-slate-300 dark:border-slate-700",
    secundaryInteraction:
      "border-slate-400 dark:border-slate-600 bg-slate-100 dark:bg-slate-800",
    secundaryInteractionIcon: "text-slate-700 dark:text-slate-300",
    separatorColor: "border-slate-300 dark:border-slate-700",
    hoverColor: "",
    icon: "/icons/timeline/movement-with-cargo.svg",
  },
  compromised: {
    dict_name: "compromised_condition",
    color: "border-rose-700",
    innerColor: "bg-rose-50",
    textColor: "text-black dark:text-white",
    bgColor: "border border-slate-300 dark:border-slate-700",
    secundaryInteraction:
      "border-slate-400 dark:border-slate-600 bg-slate-100 dark:bg-slate-800",
    secundaryInteractionIcon: "text-slate-700 dark:text-slate-300",
    separatorColor: "border-slate-300 dark:border-slate-700",
    hoverColor: "",
    icon: "/icons/conditions/comprometida.svg",
  },
  "compromised condition": {
    dict_name: "compromised_condition",
    color: "border-rose-700",
    innerColor: "bg-rose-50",
    textColor: "text-black dark:text-white",
    bgColor: "border border-slate-300 dark:border-slate-700",
    secundaryInteraction:
      "border-slate-400 dark:border-slate-600 bg-slate-100 dark:bg-slate-800",
    secundaryInteractionIcon: "text-slate-700 dark:text-slate-300",
    separatorColor: "border-slate-300 dark:border-slate-700",
    hoverColor: "",
    icon: "/icons/conditions/comprometida.svg",
  },
  "under observation": {
    dict_name: "in_observation",
    color: "border-rose-700",
    textColor: "text-black dark:text-white",
    innerColor: "bg-white",
    bgColor: "border border-slate-300 dark:border-slate-700",
    secundaryInteraction:
      "border-slate-400 dark:border-slate-600 bg-slate-100 dark:bg-slate-800",
    secundaryInteractionIcon: "text-slate-700 dark:text-slate-300",
    separatorColor: "border-slate-300 dark:border-slate-700",
    hoverColor: "",
    icon: "/icons/conditions/en-observacion.svg",
  },
  observation: {
    dict_name: "in_observation",
    color: "border-rose-700",
    textColor: "text-black dark:text-white",
    innerColor: "bg-white",
    bgColor: "border border-slate-300 dark:border-slate-700",
    secundaryInteraction:
      "border-slate-400 dark:border-slate-600 bg-slate-100 dark:bg-slate-800",
    secundaryInteractionIcon: "text-slate-700 dark:text-slate-300",
    separatorColor: "border-slate-300 dark:border-slate-700",
    hoverColor: "",
    icon: "/icons/conditions/en-observacion.svg",
  },
  remission: {
    dict_name: "in_remission",
    color: "border-teal-700",
    innerColor: "bg-teal-50",
    textColor: "text-black dark:text-white",
    bgColor: "border border-slate-300 dark:border-slate-700",
    secundaryInteraction:
      "border-slate-400 dark:border-slate-600 bg-slate-100 dark:bg-slate-800",
    secundaryInteractionIcon: "text-slate-700 dark:text-slate-300",
    separatorColor: "border-slate-300 dark:border-slate-700",
    hoverColor: "",
    icon: "/icons/conditions/en-remision.svg",
  },
  "ignore condition": {
    dict_name: "in_remission",
    color: "border-teal-700",
    innerColor: "bg-teal-50",
    textColor: "text-black dark:text-white",
    bgColor: "border border-slate-300 dark:border-slate-700",
    secundaryInteraction:
      "border-slate-400 dark:border-slate-600 bg-slate-100 dark:bg-slate-800",
    secundaryInteractionIcon: "text-slate-700 dark:text-slate-300",
    separatorColor: "border-slate-300 dark:border-slate-700",
    hoverColor: "",
    icon: "/icons/conditions/en-remision.svg",
  },
};

export type SymptomType = {
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

export function getSymptom(symptom: string): SymptomType {
  const symptomIcon: SymptomType =
    Symptoms[symptom as keyof typeof Symptoms] ??
    Symptoms[symptom.toUpperCase() as keyof typeof Symptoms] ??
    Symptoms["CONTINUOUS DRIVE CHECK"]!;
  return symptomIcon;
}
