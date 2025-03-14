export default function SideMenuSkeleton() {
  return (
    <div className="flex flex-col gap-5 h-full">
      <div className="flex flex-col h-[90%] overflow-y-auto gap-3">
        <div className="h-16 w-full bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg"></div>
        <div className="h-16 w-full bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg"></div>
        <div className="h-16 w-full bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg"></div>
      </div>
      <div className="flex flex-row justify-self-end gap-1">
        <div className="rounded-l-lg h-10 w-full bg-gray-200 dark:bg-gray-700 animate-pulse"></div>
        <div className="h-10 rounded-r-lg w-full bg-gray-200 dark:bg-gray-700 animate-pulse"></div>
      </div>
    </div>
  );
}
