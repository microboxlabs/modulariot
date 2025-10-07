"use client";

import { FaTruck, FaTruckLoading } from "react-icons/fa";
import TimelineStates from "./components/state";
import React, { useEffect, useMemo } from "react";
import { Button, Spinner } from "flowbite-react";
import { useSearchParams } from "next/navigation";
import EmptyAnimation from "../symptoms/components/empty-animation";
import { I18nRecord } from "../i18n/i18n.service.types";
import { tr } from "../i18n/tr.service";
//import { ShowNotification } from "../notifications/notification";
import { useSearchLoad } from "../common/providers/client-api.provider";
import SearchScreen from "./search-screen";

const getLoadIcon = (icon: string | null = "TRUCK_LOADING") => {
  if (icon === "TRUCK_LOADING") {
    return <FaTruckLoading className="h-6 w-6" />;
  }
  return <FaTruck className="h-6 w-6" />;
};

export type State = {
  name: string;
  date: string | null;
  start: string | null;
  end: string | null;
  duration: number | null;
  icon: React.ReactElement | null;
  description?: string;
  ended: boolean;
};

/*const states: State[] = [
  {
    name: "Carga en proveedor",
    date: "30 ABR 2025",
    start: "28-07-2025",
    end: "29-07-2025",
    duration: "1 día",
    icon: <FaTruckLoading className="h-6 w-6" />,
    description: (
      <div className="text-gray-800 dark:text-gray-300 font-light">
        <div>El proveedor [nombre de proveedor] tiene su carga.</div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700 flex-grow p-2 mt-2">
          <p>Alto: 2 mts</p>
          <p>Ancho: 2 mts</p>
          <p>Largo: 2 mts</p>
        </div>
      </div>
    ),
    ended: true,
  },
  {
    name: "Carga en terminal",
    date: "30 ABR 2025",
    start: "28-07-2025",
    end: "29-07-2025",
    duration: "1 día",
    icon: <FaTruckLoading className="h-6 w-6" />,
    description: (
      <div className="text-gray-800 dark:text-gray-300 font-light">
        <div>Su carga se ha asignado al terminal [nombre de terminal].</div>
      </div>
    ),
    ended: true,
  },
  {
    name: "Carga consolidada en viaje",
    date: "30 ABR 2025",
    start: "28-07-2025",
    end: "29-07-2025",
    duration: "1 día",
    icon: <FaTruckLoading className="h-6 w-6" />,
    ended: true,
    description: <div></div>,
  },
  {
    name: "Viaje con transporte asignado",
    date: "30 ABR 2025",
    start: "28-07-2025",
    end: "29-07-2025",
    duration: "1 día",
    icon: <FaTruckLoading className="h-6 w-6" />,
    ended: true,
    description: (
      <div className="text-gray-800 dark:text-gray-300 font-light">
        <div>Se le ha asignado un transporte a su carga.</div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700 flex-grow w-full text-gray-800 dark:text-gray-300 font-light p-2 mt-2">
          <p>Conductor: Juan Perez</p>
          <p>Rut: 12.123.123-1</p>
        </div>
      </div>
    ),
  },
  {
    name: "Validación de condiciones",
    date: "30 ABR 2025",
    start: "28-07-2025",
    end: "29-07-2025",
    duration: "1 día",
    icon: <FaTruckLoading className="h-6 w-6" />,
    ended: true,
    description: <div></div>,
  },
  {
    name: "Iniciar viaje",
    date: "30 ABR 2025",
    start: "28-07-2025",
    end: "29-07-2025",
    duration: "1 día",
    icon: <FaTruckLoading className="h-6 w-6" />,
    ended: false,
    description: (
      <div className="text-gray-800 dark:text-gray-300 font-light">
        <div>
          Su carga se encuentra en camino, pronto podra revisar su posicion en
          tiempo real.
        </div>
      </div>
    ),
  },
  {
    name: "Viaje En transito",
    date: "30 ABR 2025",
    start: "28-07-2025",
    end: "29-07-2025",
    duration: "1 día",
    icon: <FaTruckLoading className="h-6 w-6" />,
    ended: false,
    description: <div></div>,
  },
  {
    name: "Viaje arribado",
    date: "30 ABR 2025",
    start: "28-07-2025",
    end: "29-07-2025",
    duration: "1 día",
    icon: <FaTruckLoading className="h-6 w-6" />,
    ended: false,
    description: <div></div>,
  },
  {
    name: "Carga en coordinación",
    date: "30 ABR 2025",
    start: "28-07-2025",
    end: "29-07-2025",
    duration: "1 día",
    icon: <FaTruckLoading className="h-6 w-6" />,
    ended: false,
    description: <div></div>,
  },
];*/

export default function Timeline({
  dict,
  messages,
}: {
  dict: I18nRecord;
  messages: I18nRecord;
}) {
  const [actualState, setActualState] = React.useState(6);
  const timelineRef = React.useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();
  const loadId = searchParams.get("loadId");

  const { data, error, isLoading } = useSearchLoad(loadId ?? "");

  const states = useMemo(() => {
    return data && data.length > 0
      ? data?.map((item) => {
          return {
            name: item.nombre_etapa_,
            date: item.base_start_time_
              ? item.base_start_time_
              : item.start_time__,
            start: item.start_time__,
            end: item.end_time__,
            duration: item.duration__,
            icon: getLoadIcon(item.icon),
            description: item.extradata && item.extradata.Tipo_carga,
            ended: item.end_time__ ? true : false,
          };
        })
      : [];
  }, [data]);

  useEffect(() => {
    if (timelineRef.current) {
      const targetElement = timelineRef.current.children[actualState + 1]; // +1 because debug div is first child
      if (targetElement) {
        targetElement.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    }
  }, [actualState]);

  if (!loadId) {
    return (
      <SearchScreen
        dict={dict}
        messages={messages}
        searchParams={searchParams}
      />
    );
  }

  if (data && data.length === 0) {
    return (
      <div className="w-full h-full p-2 text-gray-900 dark:text-gray-100 flex flex-col justify-center items-center text-lg">
        <EmptyAnimation />
        <p className="text-lg text-gray-500 mt-10">
          {tr("wheres_my_load.not_found", dict as I18nRecord)}
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
        {error.message}
      </div>
    );
  }

  console.log(states);

  return (
    <div ref={timelineRef} className="w-fit h-full flex flex-col">
      <div className="absolute bottom-2 right-2 h-fit w-fit bg-amber-500 rounded-md p-2">
        <h1>Debug: {actualState}</h1>
        <div className="flex flex-col gap-2">
          <Button onClick={() => setActualState(Math.max(0, actualState - 1))}>
            -1
          </Button>
          <Button onClick={() => setActualState(actualState + 1)}>+1</Button>
        </div>
      </div>
      {states.map((state, index) => {
        return (
          <TimelineStates
            key={index}
            index={index}
            actualState={actualState}
            state={state}
            statesCount={states.length}
          />
        );
      })}
    </div>
  );
}
