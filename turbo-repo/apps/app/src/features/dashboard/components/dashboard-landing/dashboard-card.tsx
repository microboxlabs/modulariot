"use client";

import { useRouter, useParams } from "next/navigation";
import { HiChartPie } from "react-icons/hi";

interface DashboardCardProps {
  slug: string;
  name: string;
}

export function DashboardCard({
  slug,
  name,
}: Readonly<DashboardCardProps>) {
  const router = useRouter();
  const params = useParams<{ lang: string }>();

  const handleClick = () => {
    router.push(`/${params.lang}/home/${slug}`);
  };

  return (
    <button
      type="button"
      className="group relative flex cursor-pointer flex-col items-start rounded-lg border border-gray-200 bg-white p-5 text-left transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
      onClick={handleClick}
    >
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/20">
        <HiChartPie className="h-5 w-5 text-blue-500" />
      </div>
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
        {name}
      </h3>
    </button>
  );
}
