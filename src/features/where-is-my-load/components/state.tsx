import { FaCheck } from "react-icons/fa";
import { State } from "../timeline";

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
    <>
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
                className={`h-full w-full rounded-full flex items-center justify-center text-gray-500 dark:text-gray-400 ${actualState == index ? "border border-gray-500" : ""}`}
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
          className={`mb-10 flex flex-col drop-shadow-md transition-all duration-200 border ${actualState == index ? "border-gray-500 p-2" : "border-transparent p-1"} rounded-md`}
        >
          <div>
            {/*type === "tooltip" && <WithTooltip />*/}
            {/*type === "inline" && <InLine />*/}
            {/*type === "explicative" && <Explicative />*/}
            <ProblemLog />
            <h1 className="text-lg font-semibold text-gray-700 dark:text-gray-100">
              {state.name}
            </h1>
          </div>
          <div className="text-gray-800 dark:text-gray-300 font-light">
            {/* Reemplaza por el valor de retraso entre inicio y inicio estimado o fin y fin estimado */}
            <div className="bg-red-500 rounded-md">
              <span className="text-white text-md py-1 px-2">
                Fin con Retraso de 5 Hrs, 30 Min y 15 Seg
              </span>
            </div>

            {state.description}
          </div>
        </div>
      </div>
    </>
  );
}

/*
function WithTooltip() {
  return (
    <div className="text-sm font-light text-gray-500 dark:text-gray-400 flex flex-row gap-2">
      <span className="cursor-pointer">Inicio: 9-05-2025</span>
      <Tooltip
        style="auto"
        content="Retraso de 5 Horas, 30 Minutos y 15 Segundos"
        className="text-sm font-light whitespace-nowrap"
      >
        <span className="text-red-500 cursor-pointer whitespace-nowrap">
          Fin: 10-05-2025!
        </span>
      </Tooltip>
    </div>
  );
}

function InLine() {
  return (
    <div className="text-sm font-light text-gray-500 dark:text-gray-400 flex flex-row gap-2">
      <span className="cursor-pointer">Inicio: 9-05-2025</span>
      <span className="cursor-pointer whitespace-nowrap">
        Fin:{" "}
        <span className="text-red-500 cursor-pointer whitespace-nowrap">
          10-05-2025
        </span>{" "}
        (5 Horas, 30 Minutos y 15 Segundos)
      </span>
    </div>
  );
}

function Explicative() {
  return (
    <div className="text-sm font-light text-gray-500 dark:text-gray-400 flex flex-row gap-2">
      <span className="cursor-pointer">Inicio: 9-05-2025</span>
      <span className="cursor-pointer whitespace-nowrap">
        Fin:{" "}
        <span className="text-red-500 cursor-pointer whitespace-nowrap">
          10-05-2025
        </span>{" "}
        (Retraso de 5 Hrs, 30 Min y 15 Seg)
      </span>
    </div>
  );
}
  */

function ProblemLog() {
  return (
    <div className="text-sm font-light text-gray-500 dark:text-gray-400 flex flex-row gap-2">
      <span className="cursor-pointer">Inicio: 9-05-2025</span>
      <span className="cursor-pointer whitespace-nowrap">
        Fin:{" "}
        <span className="text-red-500 cursor-pointer whitespace-nowrap">
          10-05-2025
        </span>
      </span>
    </div>
  );
}
