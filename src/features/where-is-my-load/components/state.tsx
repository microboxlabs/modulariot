import { FaCheck } from "react-icons/fa";
import { State } from "../timeline";
import FormattedDate from "@/features/common/components/formatted-date";

export default function TimelineStates({
  index,
  actualState,
  state,
  statesCount,
}: {
  index: number;
  actualState: number;
  state: State;
  statesCount: number;
}) {
  return (
    <div className="w-fit flex flex-row gap-2 relative">
      <div className="w-10 flex flex-col items-center z-10">
        {actualState > index ? (
          <div className="h-12 w-12 bg-gray-800 dark:bg-gray-200 rounded-full flex items-center justify-center border-4 border-gray-50 dark:border-gray-900 text-gray-100 dark:text-gray-700">
            <FaCheck className="h-6 w-6" />
          </div>
        ) : (
          <div
            className={`h-12 w-12 rounded-full flex items-center justify-center border-4 bg-gray-100 dark:bg-gray-800 border-gray-50 dark:border-gray-900 ${actualState < index ? "text-gray-500" : "text-gray-700 dark:text-gray-100"}`}
          >
            <div
              className={`h-full w-full rounded-full flex items-center justify-center text-gray-500 dark:text-gray-400 ${actualState == index ? "border border-blue-500" : ""}`}
            >
              {state.icon}
            </div>
          </div>
        )}
      </div>

      {index < statesCount - 1 && (
        <div className="absolute left-5 top-10 w-0.5 h-full bg-gray-500 dark:bg-gray-100"></div>
      )}

      <div
        className={`mb-10 flex flex-col drop-shadow-md transition-all duration-200 border ${actualState == index ? "border-blue-500 p-2" : "border-transparent p-1"} rounded-md`}
      >
        <div>
          <h1 className="text-sm font-light text-gray-500 dark:text-gray-400">
            <FormattedDate date={state.date} format="datetime" />
          </h1>
          <h1 className="text-lg font-bold text-gray-700 dark:text-gray-100">
            {state.name}
          </h1>
        </div>
        <div>{state.description}</div>
      </div>
    </div>
  );
}
