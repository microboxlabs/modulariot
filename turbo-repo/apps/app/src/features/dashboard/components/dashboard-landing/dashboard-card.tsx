"use client";

import { useRouter, useParams } from "next/navigation";
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
  const router = useRouter();
  const params = useParams<{ lang: string }>();

  const handleClick = () => {
    router.push(`/${params.lang}/home/${slug}`);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onDelete?.();
  };

  const handleDeleteKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.stopPropagation();
      e.preventDefault();
      onDelete?.();
    }
  };

  return (
    <button
      type="button"
      className="group relative flex cursor-pointer flex-col items-start rounded-lg border border-gray-200 bg-white p-5 text-left transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
      onClick={handleClick}
    >
      {onDelete && (
        <span
          role="button"
          tabIndex={0}
          className="absolute top-2 right-2 rounded p-1 text-gray-400 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-500 group-hover:opacity-100 dark:hover:bg-red-900/20 dark:hover:text-red-400"
          onClick={handleDelete}
          onKeyDown={handleDeleteKeyDown}
          title={deleteTitle}
        >
          <HiTrash className="h-4 w-4" />
        </span>
      )}
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/20">
        <HiChartPie className="h-5 w-5 text-blue-500" />
      </div>
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
        {name}
      </h3>
    </button>
  );
}
