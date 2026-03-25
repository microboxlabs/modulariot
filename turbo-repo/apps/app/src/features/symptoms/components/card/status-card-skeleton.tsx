import { twMerge } from "tailwind-merge";

export default function StatusCardSkeleton() {
  return (
    <div
      className={twMerge(
        "px-3 py-1",
        "bg-white",
        "rounded-lg",
        "shadow-md",
        "border",
        "border-gray-400",
        "dark:bg-gray-900",
        "hover:bg-gray-100",
        "dark:hover:bg-gray-800",
        "active:bg-gray-200",
        "cursor-pointer",
        "transition-all",
        "w-full"
      )}
    >
      <div className="flex flex-row justify-between gap-4">
        <div className="flex items-center gap-2">
          <div
            className={twMerge(
              "w-6 h-6",
              "rounded-full",
              "bg-gray-200 dark:bg-gray-800",
              "flex items-center justify-center",
              "animate-pulse"
            )}
          ></div>
          <span className="text-gray-200 dark:text-gray-800 bg-gray-200 dark:bg-gray-800 text-sm font-light hidden lg:block whitespace-nowrap">
            Codigo negro
          </span>
        </div>
        <div className="flex items-end gap-2">
          <span className="text-gray-200 dark:text-gray-800 bg-gray-200 dark:bg-gray-800 rounded-md animate-pulse text-2xl font-semibold">
            00
          </span>
        </div>
      </div>
    </div>
  );
}
