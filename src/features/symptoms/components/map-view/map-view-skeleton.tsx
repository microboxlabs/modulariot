import SideMenuSkeleton from "./side-menu-skeleton";

export default function MapViewSkeleton() {
  return (
    <div className="h-full flex flex-col gap-5 p-5">
      <div className="flex flex-row gap-6 w-full h-full overflow-visible">
        {/* Side information */}
        <div className="w-[35%] h-full rounded-lg shadow-md border border-gray-200 dark:border-gray-700 overflow-y-auto animate-pulse bg-gray-100 dark:bg-gray-800">
          <SideMenuSkeleton />
        </div>
        {/* Map */}
        <div className="w-[65%] h-full rounded-lg shadow-md border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 animate-pulse overflow-hidden"></div>
      </div>
    </div>
  );
}
