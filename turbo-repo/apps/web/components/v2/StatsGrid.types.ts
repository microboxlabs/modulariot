export type StatItem = {
  prefix?: string;
  value: string;
  label: string;
};

export type StatsGridProps = {
  items: StatItem[];
  size?: "md" | "lg";
  tone?: "light" | "dark";
  align?: "left" | "center";
  wrapAt?: "sm" | "lg";
  cols?: 3 | 4;
};
