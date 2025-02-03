export type TableItemType = {
  condition: string;
  licensePlate: string;
  time: string;
  trip: string;
  driver: string;
  date: string;
  service: string;
  alertType: string;
};

export type Condition = {
  color: string;
  bgColor?: string;
  innerColor: string;
  textColor: string;
};

export const Conditions: Record<string, Condition> = {
  "code black": {
    color: "border-black",
    bgColor: "!bg-black",
    innerColor: "bg-gray-200",
    textColor: "text-white",
  },
  critic: {
    color: "border-red-500",
    bgColor: "!bg-rose-500",
    innerColor: "bg-rose-200",
    textColor: "text-white",
  },
  warning: {
    color: "border-yellow-500",
    innerColor: "bg-amber-200",
    textColor: "text-white",
  },
  info: {
    color: "border-blue-500",
    innerColor: "bg-blue-200",
    textColor: "text-white",
  },
};
