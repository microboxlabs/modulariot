import {
  HiArrowTrendingDown,
  HiArrowTrendingUp,
  HiMinus,
} from "react-icons/hi2";

interface TrendValueProps {
  readonly percentage: number;
}

const trendConfig = {
  negative: {
    colorClass: "text-red-500",
    Icon: HiArrowTrendingDown,
    format: (v: number) => `${v}%`,
  },
  positive: {
    colorClass: "text-green-500",
    Icon: HiArrowTrendingUp,
    format: (v: number) => `+${v}%`,
  },
  neutral: {
    colorClass: "text-gray-400 dark:text-gray-500",
    Icon: HiMinus,
    format: () => "0%",
  },
} as const;

function getTrendType(percentage: number): keyof typeof trendConfig {
  if (percentage < 0) return "negative";
  if (percentage > 0) return "positive";
  return "neutral";
}

export default function TrendValue({ percentage }: TrendValueProps) {
  const { colorClass, Icon, format } = trendConfig[getTrendType(percentage)];

  return (
    <span className={`flex items-center gap-1 ${colorClass}`}>
      {format(percentage)} <Icon className="w-4 h-4" />
    </span>
  );
}
