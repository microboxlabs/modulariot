"use client";

import { useRouter } from "next/navigation";

interface StatusCardProps {
  icon: React.ReactNode;
  title: string;
  count: string;
  variant?: "black" | "critical";
}

export default function StatusCard({
  icon,
  title,
  count,
  variant = "black",
}: StatusCardProps) {
  const router = useRouter();

  const bgColor = variant === "critical" ? "bg-rose-100" : "bg-gray-200";
  const borderColor = variant === "critical" ? "border-rose-700" : "border-black";

  return (
    <div onClick={() => router.push("/symptoms/symptoms-list")} className="grow p-3 bg-white rounded-lg shadow-md border border-gray-400 dark:bg-gray-900 hover:bg-gray-100 active:bg-gray-200 cursor-pointer transition-all duration-300 ease-in-out">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <div
            className={`w-6 h-6 ${bgColor} rounded-full border ${borderColor} flex items-center justify-center`}
          >
            <span className="text-white text-[8px] font-medium">{icon}</span>
          </div>
          <span className="text-[#111928] dark:text-white text-sm font-semibold">
            {title}
          </span>
        </div>
        <div className="flex items-end gap-2">
          <span className="text-gray-500 dark:text-white text-2xl font-semibold">
            {count}
          </span>
          <span className="text-gray-500 dark:text-gray-400 text-xs font-medium mb-1">
            Activos
          </span>
        </div>
      </div>
    </div>
  );
}