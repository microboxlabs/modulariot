import TimedSymptomsSkeleton from "./timed-symptoms-skeleton";

export default function SymptomsDataSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {/* Time data */}
      <div className="flex flex-col bg-gray-100 dark:bg-gray-900 rounded-lg p-3">
        <div className="w-full flex flex-row gap-5 text-sm animate-pulse">
          <div className="text-gray-200 dark:text-gray-700 bg-gray-200 dark:bg-gray-700 rounded-lg">
            01 de febrero de 2018
          </div>
          <div className="flex flex-row flex-grow justify-between">
            <p className="text-gray-200 dark:text-gray-700 bg-gray-200 dark:bg-gray-700 rounded-lg">
              hace 10 dias
            </p>
            <p className="text-gray-200 dark:text-gray-700 bg-gray-200 dark:bg-gray-700 rounded-lg">
              sintomas activos: 2400
            </p>
          </div>
        </div>
      </div>
      {/* Symptoms data */}
      <div className="pl-3 flex flex-row  text-sm gap-10 animate-pulse">
        <div className="py-2">
          <div className="flex flex-row items-center justify-center gap-2">
            <div className="w-5 h-5 bg-gray-200 dark:bg-gray-700 rounded-full" />
            <div className="flex flex-col gap-3 text-gray-200 dark:text-gray-700 bg-gray-200 dark:bg-gray-700 rounded-lg">
              10:10 - 10:15
            </div>
          </div>
        </div>
        <div className="flex flex-grow flex-column gap-2">
          <TimedSymptomsSkeleton initial_state={true} />
        </div>
      </div>
      <div className="pl-3 flex flex-row  text-sm gap-10 animate-pulse">
        <div className="py-2">
          <div className="flex flex-row items-center justify-center gap-2 ">
            <div className="w-5 h-5 bg-gray-200 dark:bg-gray-700 rounded-full" />
            <div className="flex flex-col gap-3 text-gray-200 dark:text-gray-700 bg-gray-200 dark:bg-gray-700 rounded-lg">
              10:10 - 10:15
            </div>
          </div>
        </div>
        <div className="flex flex-grow flex-column gap-2">
          <TimedSymptomsSkeleton initial_state={false} />
        </div>
      </div>
      <div className="pl-3 flex flex-row  text-sm gap-10 animate-pulse">
        <div className="py-2">
          <div className="flex flex-row items-center justify-center gap-2 ">
            <div className="w-5 h-5 bg-gray-200 dark:bg-gray-700 rounded-full" />
            <div className="flex flex-col gap-3 text-gray-200 dark:text-gray-700 bg-gray-200 dark:bg-gray-700 rounded-lg">
              10:10 - 10:15
            </div>
          </div>
        </div>
        <div className="flex flex-grow flex-column gap-2">
          <TimedSymptomsSkeleton initial_state={false} />
        </div>
      </div>
    </div>
  );
}
