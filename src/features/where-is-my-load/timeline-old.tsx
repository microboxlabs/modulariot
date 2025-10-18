import { HiCheck } from "react-icons/hi";
import ExpansibleInfoContainer from "@/features/common/components/expansible-container/expansible-info-container";

const states = [
  {
    name: "Carga en proveedor",
    date: "30 ABR 2025",
    start: "28-07-2025",
    end: "29-07-2025",
    duration: "1 día",
  },
  {
    name: "Carga en terminal",
    date: "30 ABR 2025",
    start: "28-07-2025",
    end: "29-07-2025",
    duration: "1 día",
  },
  {
    name: "Carga consolidada en viaje",
    date: "30 ABR 2025",
    start: "28-07-2025",
    end: "29-07-2025",
    duration: "1 día",
  },
];

export default function Timeline() {
  return (
    <div>
      {states.map((state, index) => (
        <div key={index} className="flex flex-row w-full gap-2 mb-4">
          <div className="w-full">
            <ExpansibleInfoContainer
              icon={<div>A</div>}
              head={
                <div className="flex flex-row justify-between w-full items-center">
                  <div className="flex flex-col">
                    <p className="whitespace-nowrap h-4 font-light text-sm text-gray-500 dark:text-gray-400">
                      {state.date}
                    </p>
                    <p>{state.name}</p>
                  </div>
                  <div className="flex flex-row items-center gap-4">
                    <div className="flex flex-row font-normal whitespace-nowrap gap-1">
                      Inicio: <span className="font-bold">{state.start}</span>
                    </div>
                    <div className="flex flex-row font-normal whitespace-nowrap gap-1">
                      Fin: <span className="font-bold">{state.end}</span>
                    </div>
                    <div className="flex flex-row font-normal whitespace-nowrap gap-1">
                      Duración:{" "}
                      <span className="font-bold">{state.duration}</span>
                    </div>
                    <div className="flex flex-row justify-center items-center gap-1 bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-200 rounded-md px-2 py-1 text-sm font-medium">
                      <HiCheck /> Completado
                    </div>
                  </div>
                </div>
              }
            >
              Hola
            </ExpansibleInfoContainer>
          </div>
        </div>
      ))}
    </div>
  );
}
