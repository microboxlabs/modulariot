"use client";

import { FaFilePen } from "react-icons/fa6";
import ConditionIcon from "./condition-icon";
import ExpandableButton from "./expandable-button";
import { Conditions } from "./table-item.type";
import { FaClock, FaTruck } from "react-icons/fa";
import Symptoms from '../../geographic-view/components/side-bar/inner-menu/symptoms';



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

export default function SideInfoData({ dict }: { dict: any }) {
  const data = {
    trip: {
      condition: "code black",
      licensePlate: "XX BB 21",
      date: "2025-01-01 12:00:00",
      trip: "STG-ANF",
      driver: "ANONIMO ANDRÉS",
      service: "V-1406865",
      alertType: dict.symptoms.continuous_driving,
    },
    actions: [
      {
        actions: dict.symptoms.warning,
        gestion: dict.symptoms.control_tower,
        assigned_to: "pia@mintral.com",
        gestion_time: "00:00:00",
      },
      {
        actions: dict.symptoms.warning,
        gestion: dict.symptoms.control_tower,
        assigned_to: "pia@mintral.com",
        gestion_time: "00:00:00",
      },
      {
        actions: dict.symptoms.warning,
        gestion: dict.symptoms.control_tower,
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

  return (
    <div className="flex flex-col gap-2 w-full">
      <ExpandableButton
        initial_state={true}
        icon={<FaTruck />}
        title={dict.symptoms.condition}
        description={dict.symptoms.relevant_information}
      >
        <div className="flex flex-col gap-2">
          <div
            className={`flex flex-row items-center gap-2 p-1 rounded-md ${Conditions[data.trip.condition as keyof typeof Conditions].bgColor}`}
          >
            <ConditionIcon condition={data.trip.condition} size="h-7 w-7" />
            <p
              className={`text-sm font-medium ${Conditions[data.trip.condition as keyof typeof Conditions].textColor}`}
            >
              {new Date(data.trip.date).toLocaleString().split(",")[1]}
              <span className="text-gray-400 text-xs">
                {" " + data.trip.licensePlate}
              </span>
            </p>
          </div>
          <p className="text-sm">
            {dict.symptoms.observed_symptom}:{" "}
            <span className="text-gray-500 dark:text-gray-400">{data.trip.alertType}</span>
          </p>
          <p className="text-sm">
            {dict.symptoms.event}:{" "}
            <span className="text-gray-500 dark:text-gray-400">
              4.5 {dict.symptoms.hours} {" "} {dict.symptoms.continuous_driving}
            </span>
          </p>
          <p className="text-sm">
            {dict.symptoms.trip}: <span className="text-gray-500 dark:text-gray-400">{data.trip.trip}</span>
          </p>
          <p className="text-sm">
            {dict.symptoms.trip_time}:{" "}
            <span className="text-gray-500 dark:text-gray-400">16:33:12 hrs</span>
          </p>
          <p className="text-sm">
            {dict.symptoms.service}: <span className="text-gray-500 dark:text-gray-400">{data.trip.service}</span>
          </p>
          <p className="text-sm">
            {dict.symptoms.prescription}:{" "}
            <span className="text-gray-500 dark:text-gray-400">{dict.symptoms.call_driver}</span>
          </p>
        </div>
      </ExpandableButton>
      {/* Registro de acciones */}
      <ExpandableButton
        icon={<FaFilePen />}
        title={dict.symptoms.actions}
        description={dict.symptoms.actions_description}
      >
        <div className="flex flex-col gap-2">
          {data.actions.map((action, index) => (
            <div key={index} className="flex flex-col gap-2 p-1 ">
              <p className="rounded-md bg-gray-200 dark:bg-gray-600 w-full p-2 px-5">
                {index + 1}.
              </p>
              <div className="grid grid-cols-2 gap-1 px-2">
                <p className="text-sm font-medium w-full">
                  {dict.symptoms.actions}:
                  <span className="font-light text-gray-500 dark:text-gray-400">
                    {" " + action.actions}
                  </span>
                </p>
                <p className="text-sm font-medium w-full">
                  {dict.symptoms.management}:
                  <span className="font-light text-gray-500 dark:text-gray-400">
                    {" " + action.gestion}
                  </span>
                </p>
                <p className="text-sm font-medium w-full">
                  {dict.symptoms.assigned_to}:
                  <span className="font-light text-gray-500 dark:text-gray-400">
                    {" " + action.assigned_to}
                  </span>
                </p>
                <p className="text-sm font-medium w-full">
                  {dict.symptoms.management_time}:
                  <span className="font-light text-gray-500 dark:text-gray-400">
                    {" " + action.gestion_time}
                  </span>
                </p>
              </div>
            </div>
          ))}
        </div>
      </ExpandableButton>
      {/* Timeline */}
      <ExpandableButton
        icon={<FaClock />}
        title={dict.symptoms.timeline}
        description={dict.symptoms.timeline_description}
      >
        <div className="flex flex-col gap-2 bg-gray-50 dark:bg-gray-800 rounded-md p-2">
          {data.timeline.map((item, index) => {
            const date = formatDate(new Date(item.date));
            const duration = calculateDuration(
              item.items[item.items.length - 1].start,
            );

            return (
              <div key={index} className="flex flex-col gap-2">
                <div className="flex flex-col bg-gray-100 dark:bg-gray-900 rounded-lg p-3">
                  <div className="w-full flex flex-row gap-5 text-sm items-center justify-between px-2">
                    <div className="text-black dark:text-white">{date}</div>
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
                <div className="flex flex-col gap-2 bg">
                  {item.items.map((item, index) => (
                    <div key={index} className="flex flex-row gap-2">
                      <div className="flex flex-col">
                        <ConditionIcon
                          condition={item.condition}
                          size="h-7 w-7"
                        />
                        <div className="w-[2px] mt-1 mx-auto bg-gray-400 flex-grow" />
                      </div>
                      <div className="flex flex-col gap-2">
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                          {new Date(item.start).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}{" "}
                          - {" "}
                          {new Date(item.end).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-200">
                          {item.condition}
                        </p>
                        <p className="text-sm font-light text-gray-900 dark:text-gray-200">
                          {item.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </ExpandableButton>
    </div>
  );
}
