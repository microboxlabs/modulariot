import { FaCheck } from "react-icons/fa";
import { State } from "../timeline";
import { FormattedDate } from "@/features/common/components/formatted-date";
import { fromString } from "@/features/common/services/days.service";

export default function TimelineStates({
  index,
  count,
  actualState,
  state,
  statesCount,
}: {
  index: number;
  count: number;
  actualState: number;
  state: State;
  statesCount: number;
}) {
  const is_urgent = state.urgent;
  const is_enabled = state;
  const temporalData = TemporalComponent({ time: state.time });

  return (
    <>
      <div className="w-full flex flex-row gap-2 relative whitespace-nowrap">
        <div className="w-10 flex flex-col items-center z-10">
          {actualState > index ? (
            <div
              className={`h-12 w-12 bg-gray-800 dark:bg-gray-200 rounded-full flex items-center justify-center border-4 border-gray-50 dark:border-gray-900 text-gray-100 dark:text-gray-700 ${is_urgent ? " bg-purple-500 dark:bg-purple-400" : ""}`}
            >
              <FaCheck className="h-6 w-6" />
            </div>
          ) : (
            <div
              className={`h-12 w-12 rounded-full flex items-center justify-center border-4 bg-gray-100 dark:bg-gray-800 border-gray-50 dark:border-gray-900 ${actualState < index ? "text-gray-500" : "text-gray-700 dark:text-gray-100"}`}
            >
              <div
                className={`h-full w-full rounded-full flex items-center justify-center text-gray-500 dark:text-gray-400 ${actualState == index ? "border border-gray-500 bg-blue-50 dark:bg-blue-900" : ""} ${is_urgent ? "border-2 border-purple-500" : ""}`}
              >
                {index + 1}
              </div>
            </div>
          )}
        </div>

        {index < statesCount - 1 && (
          <div className="absolute left-5 top-10 w-0.5 h-full bg-gray-500 dark:bg-gray-100"></div>
        )}

        <div
          className={`${index != count - 1 ? "mb-10" : ""} ${is_enabled ? "" : "opacity-50"} w-full flex flex-col drop-shadow-md transition-all duration-200 border ${actualState == index ? "border-gray-500 p-2 drop-shadow-md bg-blue-50 dark:bg-blue-900" + (is_urgent ? " border-purple-500" : "") : "border-transparent p-1"} rounded-md hover:bg-gray-100`}
        >
          <div>
            {(() => {
              return temporalData.component;
            })()}
            <h1 className="text-lg font-semibold text-gray-700 dark:text-gray-100">
              {state.name}
            </h1>
          </div>
          <div
            className={`text-gray-800 dark:text-gray-300 font-light flex flex-col gap-2 `}
          >
            <div className="flex flex-col gap-1">
              {/* Reemplaza por el valor de retraso entre inicio y inicio estimado o fin y fin estimado */}
              <DelayComponent
                label="Inicio con Retraso de "
                delay={temporalData.start_delay}
              />
              <DelayComponent
                label="Fin con Retraso de "
                delay={temporalData.end_delay}
              />
            </div>

            {state.description}
          </div>
        </div>
      </div>
    </>
  );
}

function TemporalComponent({
  time,
}: {
  time: {
    start: string | null;
    estimated_start: string | null;
    end: string | null;
    estimated_end: string | null;
    duration: number | null;
  };
}) {
  if (
    time.start === null &&
    time.estimated_start === null &&
    time.end === null &&
    time.estimated_end === null
  ) {
    return {
      start_delay: null,
      end_delay: null,
      component: null,
    };
  }

  const start = fromString(
    (time.start ? time.start : time.estimated_start) as string
  ).format("MM/DD/YYYY HH:mm");

  const start_delayed =
    time.start && time.estimated_start
      ? fromString(time.start).isAfter(fromString(time.estimated_start))
      : false;

  const start_delay =
    start_delayed && time.start && time.estimated_start
      ? fromString(time.start).diff(fromString(time.estimated_start))
      : null;

  const end = fromString(
    (time.end ? time.end : time.estimated_end) as string
  ).format("MM/DD/YYYY HH:mm");

  const end_delayed =
    time.end != null && time.estimated_end != null
      ? fromString(time.end).isAfter(fromString(time.estimated_end))
      : false;

  const end_delay =
    end_delayed && time.end && time.estimated_end
      ? fromString(time.end).diff(fromString(time.estimated_end))
      : null;

  return {
    component: (
      <div className="text-sm font-light text-gray-500 dark:text-gray-400 flex flex-row gap-2">
        <span>
          {time.start ? "Inicio" : "Inicio Estimado"}:{" "}
          <span
            className={`${start_delayed ? "text-red-500 dark:text-red-300" : ""} whitespace-nowrap`}
          >
            <FormattedDate date={start} format="date" />
          </span>
        </span>
        <span>
          {time.start ? "Fin" : "Fin Estimado"}:{" "}
          <span
            className={`${end_delayed ? "text-red-500 dark:text-red-300" : ""} whitespace-nowrap`}
          >
            <FormattedDate date={end} format="date" />
          </span>
        </span>
      </div>
    ),
    start_delay, // Duration object or null, if its a duration object paint the flag in the main component
    end_delay, // Duration object or null, if its a duration object paint the flag in the main component
  };
}

function DelayComponent({
  label,
  delay,
}: {
  label: string;
  delay: number | null;
}) {
  if (delay === null) return null;

  // Convert milliseconds to a readable format
  const formatDuration = (ms: number) => {
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);

    return parts.length > 0 ? parts.join(" ") : "0m";
  };

  return (
    <div className="bg-red-500 rounded-md w-fit">
      <span className="text-white text-sm py-1 px-2 whitespace-nowrap">
        {label} {formatDuration(delay)}
      </span>
    </div>
  );
}
