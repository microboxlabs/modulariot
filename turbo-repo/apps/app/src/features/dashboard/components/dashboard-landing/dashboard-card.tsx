"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { HiChartPie, HiTrash } from "react-icons/hi";

interface DashboardCardProps {
  slug: string;
  name: string;
  onDelete?: () => void;
  deleteTitle?: string;
}

export function DashboardCard({
  slug,
  name,
  onDelete,
  deleteTitle,
}: Readonly<DashboardCardProps>) {
  const params = useParams<{ lang: string }>();

  return (
    <div className="group relative flex flex-col items-start rounded-lg border border-gray-200 bg-white p-5 text-left transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-800">
      <Link
        href={`/${params.lang}/home/${slug}`}
        className="absolute inset-0 z-0"
        aria-label={name}
      />
      {onDelete && (
        <button
          type="button"
          className="relative z-10 ml-auto -mr-2 -mt-2 rounded p-1 text-gray-400 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-500 group-hover:opacity-100 dark:hover:bg-red-900/20 dark:hover:text-red-400"
          onClick={onDelete}
          title={deleteTitle}
        >
          <HiTrash className="h-4 w-4" />
        </button>
      )}
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/20">
        <HiChartPie className="h-5 w-5 text-blue-500" />
      </div>
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
        {name}
      </h3>
    </div>
  );
}
