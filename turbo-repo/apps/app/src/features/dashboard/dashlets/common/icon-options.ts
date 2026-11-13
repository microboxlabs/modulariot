import {
  HiChartBar,
  HiCurrencyDollar,
  HiUsers,
  HiShoppingCart,
  HiClock,
  HiCheckCircle,
} from "react-icons/hi2";
import type { ComponentType } from "react";

/** Union of shared icon keys used by card-style dashlets. */
export type DashletIconKey = "chart" | "currency" | "users" | "cart" | "clock" | "check";

/** A legacy dashlet icon: its key, label and component. */
interface DashletIconOption {
  value: DashletIconKey;
  label: string;
  icon: ComponentType<{ className?: string }>;
}

/** Shared icon picker options used by card-style dashlets (card, labeled_data). */
export const DASHLET_ICON_OPTIONS: DashletIconOption[] = [
  { value: "chart", label: "Chart", icon: HiChartBar },
  { value: "currency", label: "Currency", icon: HiCurrencyDollar },
  { value: "users", label: "Users", icon: HiUsers },
  { value: "cart", label: "Cart", icon: HiShoppingCart },
  { value: "clock", label: "Clock", icon: HiClock },
  { value: "check", label: "Check", icon: HiCheckCircle },
];
