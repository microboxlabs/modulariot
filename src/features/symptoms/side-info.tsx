"use client";

import { FaFilePen } from "react-icons/fa6";
import ConditionIcon from "./components/condition-icon";
import ExpandableButton from "./components/expandable-button";
import { HiArrowRight } from "react-icons/hi";
import { Conditions } from "./components/table-item.type";
import { FaClock, FaTruck } from "react-icons/fa";
import { Button } from "flowbite-react";
import BlurrableDropdown from "./components/blurrable-dropdown";

const data = {
  trip: {
    condition: "code black",
    licensePlate: "XX BB 21",
    date: "2025-01-01 12:00:00",
    trip: "STG-ANF",
    driver: "ANONIMO ANDRÉS",
    service: "V-1406865",
    alertType: "Conducción máxima continua",
  },
  actions: [
    {
      actions: "Aviso preventivo",
      gestion: "Torre de control",
      assigned_to: "pia@mintral.com",
      gestion_time: "00:00:00",
    },
    {
      actions: "Aviso preventivo",
      gestion: "Torre de control",
      assigned_to: "pia@mintral.com",
      gestion_time: "00:00:00",
    },
    {
      actions: "Aviso preventivo",
      gestion: "Torre de control",
      assigned_to: "pia@mintral.com",
      gestion_time: "00:00:00",
    },
  ],
  timeline: [
    {
      date: "2025-01-01",
      assigned_to: "juan@mintral.com",
      items: [
        {
          start: "2025-01-01 12:00:00",
          end: "2025-01-01 12:30:00",
          condition: "code black",
          description: "Mensaje de ejemplo de descripción.",
        },
        {
          start: "2025-01-01 12:00:00",
          end: "2025-01-01 12:30:00",
          condition: "code black",
          description: "Mensaje de ejemplo de descripción.",
        },
      ],
    },
    {
      date: "2025-02-12",
      assigned_to: "juan@mintral.com",
      items: [
        {
          start: "2025-02-12 10:00:00",
          end: "2025-02-12 10:30:00",
          condition: "critic",
          description: "Mensaje de ejemplo de descripción.",
        },
      ],
    },
    {
      date: "2025-02-12",
      assigned_to: "juan@mintral.com",
      items: [
        {
          start: "2025-02-12 10:00:00",
          end: "2025-02-12 10:30:00",
          condition: "critic",
          description: "Mensaje de ejemplo de descripción.",
        },
      ],
    },
    {
      date: "2025-02-12",
      assigned_to: "juan@mintral.com",
      items: [
        {
          start: "2025-02-12 10:00:00",
          end: "2025-02-12 10:30:00",
          condition: "critic",
          description: "Mensaje de ejemplo de descripción.",
        },
      ],
    },
  ],
};

function formatDate(date: Date): string {
  const options: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    year: "numeric",
  };

  return new Intl.DateTimeFormat("es-ES", options)
    .format(date)
    .toUpperCase()
    .replace(".", "");
}

function calculateDuration(startTime: string): string {
  const start = new Date(startTime);
  const now = new Date();
  const diffInMs = now.getTime() - start.getTime();

  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMinutes / 60);
  const diffInDays = Math.floor(diffInHours / 24);

  if (diffInMinutes < 60) {
    return `${diffInMinutes} min`;
  } else if (diffInHours < 24) {
    return `${diffInHours} hr${diffInHours > 1 ? "s" : ""}`;
  } else {
    return `${diffInDays} day${diffInDays > 1 ? "s" : ""}`;
  }
}

export default function SideInfo() {
  return (
    <div className="flex flex-col gap-5 p-10 h-full">
      <div className="flex flex-col gap-2 h-[90%] overflow-y-auto">
        <ExpandableButton
          icon={<FaTruck />}
          title="Condición"
          description="Información relevante de la detección de anomalías."
        >
          <div className="flex flex-col gap-2">
            <div
              className={`flex flex-row items-center gap-2 p-1 rounded-md ${Conditions[data.trip.condition as keyof typeof Conditions].bgColor}`}
            >
              <ConditionIcon condition={data.trip.condition} size="h-7 w-7" />
              <p
                className={`text-sm font-medium ${Conditions[data.trip.condition as keyof typeof Conditions].textColor}`}>{new Date(data.trip.date).toLocaleString().split(",")[1]}
                <span className="text-gray-400 text-xs">
                  {" " + data.trip.licensePlate}
                </span>
              </p>
            </div>
            <p className="text-sm">
              Síntoma observado: <span className="text-gray-500">{data.trip.alertType}</span>
            </p>
            <p className="text-sm">
              Evento: <span className="text-gray-500">4.5 Horas de conducción sin descanso</span>
            </p>
            <p className="text-sm">
              Trayecto: <span className="text-gray-500">{data.trip.trip}</span>
            </p>
            <p className="text-sm">
              Tiempo de trayecto: <span className="text-gray-500">16:33:12 hrs</span>
            </p>
            <p className="text-sm">
              Servicio: <span className="text-gray-500">{data.trip.service}</span>
            </p>
            <p className="text-sm">
              Prescripción recomendada: <span className="text-gray-500">Llamar al conductor</span>
            </p>
          </div>
        </ExpandableButton>
        {/* Registro de acciones */}
        <ExpandableButton
          icon={<FaFilePen />}
          title="Registro de acciones"
          description="Acciones realizadas anteriormente."
        >
          <div className="flex flex-col gap-2">
            {data.actions.map((action, index) => (
              <div key={index} className="flex flex-col gap-2 p-1 ">
                <p className="rounded-md bg-gray-200 w-full p-2 px-5">{index + 1}.</p>
                <div className="grid grid-cols-2 gap-1 px-2">
                  <p className="text-sm font-medium w-full">Acciones:<span className="font-light text-gray-500">{" " + action.actions}</span></p>
                  <p className="text-sm font-medium w-full">Gestión:<span className="font-light text-gray-500">{" " + action.gestion}</span></p>
                  <p className="text-sm font-medium w-full">Encargado:<span className="font-light text-gray-500">{" " + action.assigned_to}</span></p>
                  <p className="text-sm font-medium w-full">Hora gestión:<span className="font-light text-gray-500">{" " + action.gestion_time}</span></p>
                </div>
              </div>
            ))}
          </div>
        </ExpandableButton >
        {/* Timeline */}
        <ExpandableButton
          icon={< FaClock />}
          title="timeline"
          description="Historial de condiciones anteriores."
        >
          <div className="flex flex-col gap-2 bg-gray-50 rounded-md p-2">
            {data.timeline.map((item, index) => {
              const date = formatDate(new Date(item.date));
              const duration = calculateDuration(item.items[item.items.length - 1].start);

              return (
                <div key={index} className="flex flex-col gap-2">
                  <div className="flex flex-col bg-gray-100 dark:bg-gray-900 rounded-lg p-3">
                    <div className="w-full flex flex-row gap-5 text-sm items-center justify-between px-2">
                      <div className="text-black dark:text-white">
                        {date}
                      </div>
                      <div className="flex flex-row flex-grow justify-between">
                        <p className="bg-blue-200 rounded-md px-2 py-1 text-gray-600 flex items-center">
                          {item.assigned_to}
                        </p>
                        <p className="text-gray-500 dark:text-gray-400">
                          {duration}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    {item.items.map((item, index) => (
                      <div key={index} className="flex flex-row gap-2">
                        <div className="flex flex-col">
                          <ConditionIcon condition={item.condition} size="h-7 w-7" />
                          <div className="w-[2px] mt-1 mx-auto bg-gray-400 flex-grow" />
                        </div>
                        <div className="flex flex-col gap-2">
                          <p className="text-sm font-medium text-gray-600">
                            {new Date(item.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -
                            {new Date(item.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                          <p className="text-sm font-medium text-gray-900">{item.condition}</p>
                          <p className="text-sm font-light text-gray-900">{item.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </ExpandableButton>
      </div >
      <div className="flex flex-col justify-self-end">
        <Button.Group className="w-full">
          <BlurrableDropdown />
          <Button
            size="md"
            color="blue"
            onClick={() => { console.log("open option") }}
            className={`h-10 rounded-l-none w-full`}
          >
            Llamar al conductor
            <HiArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </Button.Group>
      </div>
    </div >
  );
}
