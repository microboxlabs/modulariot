import { ReactNode } from "react";

interface DashboardFeatureCardProps {
  icon: ReactNode;
  title: string;
  description: string;
}

export function DashboardFeatureCard({
  icon,
  title,
  description,
}: Readonly<DashboardFeatureCardProps>) {
  return (
    <div className="flex flex-col rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/20">
        {icon}
      </div>
      <h3 className="mb-2 text-base font-semibold text-gray-900 dark:text-white">
        {title}
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
    </div>
  );
}
