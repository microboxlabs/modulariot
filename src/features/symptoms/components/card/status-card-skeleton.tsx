import { twMerge } from "tailwind-merge";

export default function StatusCardSkeleton() {
  return (
    <div
      className={twMerge(
        "grow p-3",
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
      )}
    >
      <div className="flex flex-row justify-between gap-5">
        <div className="flex items-center gap-3">
          <div
            className={twMerge(
              "w-8 h-8",
              "rounded-full",
              "bg-gray-200 dark:bg-gray-800",
              "flex items-center justify-center",
              "animate-pulse",
            )}
          ></div>
          <span className="text-gray-200 dark:text-gray-800 bg-gray-200 dark:bg-gray-800 text-sm font-light hidden lg:block whitespace-nowrap">
            Ejemplo
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
