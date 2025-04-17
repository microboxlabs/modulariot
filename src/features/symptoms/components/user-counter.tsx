import { Tooltip } from "flowbite-react";
import { useGetUserStates } from "@/features/common/providers/client-api.provider";
import ConditionIcon from "./condition-icon";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { pin_conditions } from "@/features/geographic-view/types/pin_conditions";
import { useState } from "react";
const color_selector = [
  "bg-rose-100 text-rose-600 border-rose-600",
  "bg-amber-100 text-amber-600 border-amber-600",
  "bg-blue-100 text-blue-600 border-blue-600",
  "bg-gray-100 text-gray-600 border-gray-600",
];

export default function UserStateCounter({ dict }: { dict: I18nRecord }) {
  const [open, setOpen] = useState(false);
  const { user_states, user_states_error, user_states_isLoading } =
    useGetUserStates();

  if (user_states_isLoading) {
    return <div></div>;
  }

  if (user_states_error) {
    return <div>Error: {user_states_error.message}</div>;
  }

  console.log(user_states.userStates);

  return (
    <div
      className={`flex flex-row transition-all duration-300 cursor-pointer ${!open ? "" : ""} hover:cursor-pointer `}
      onClick={() => setOpen(!open)}
    >
      {user_states.userStates.map((user: any, index: number) => {
        const random_tailwind_color =
          color_selector[Math.floor(Math.random() * color_selector.length)];

        const user_state = getUserState(user);

        return (
          <div
            className={`relative transition-all duration-300 ${!open ? "ml-[-2.0rem]" : "ml-2"}`}
            key={index}
          >
            <Tooltip
              theme={{
                target: "w-fit",
                animation: "transition-opacity",
                arrow: {
                  base: "absolute z-10 h-2 w-2 rotate-45",
                  style: {
                    dark: "bg-gray-900 dark:bg-gray-700",
                    light: "bg-white",
                    auto: `${user_state === "inactive" ? "bg-red-400 dark:bg-red-700" : "bg-white dark:bg-gray-700"}`,
                  },
                  placement: "-4px",
                },
                base: "absolute z-10 inline-block rounded-lg px-3 py-2 text-sm font-medium shadow-sm",
                hidden: "invisible opacity-0",
                style: {
                  dark: "bg-gray-900 text-white dark:bg-gray-700",
                  light: "border border-gray-200 bg-white text-gray-900",
                  auto: `${user_state === "inactive" ? "bg-red-400 text-red-900 dark:bg-red-700 dark:text-red-100" : "bg-white dark:bg-gray-700 text-gray-900 dark:text-white"} border border-gray-200  dark:border-none  `,
                },
                content: "relative z-20",
              }}
              style="auto"
              content={
                <div className="font-light whitespace-nowrap">
                  {tooltipContent(user, dict)}
                </div>
              }
            >
              <div
                key={index}
                className={`relative border-2 flex justify-center items-center transition-all duration-300 rounded-full p-1 first:p-0 ${random_tailwind_color} h-10 w-10`}
              >
                <div
                  className={`h-3 w-3 rounded-full absolute top-0 right-0 ${statusColor(user)} border-2 border-white`}
                ></div>
                {user.firstName[0]}
                {user.lastName[0]}
              </div>
            </Tooltip>
          </div>
        );
      })}
      {/*users.length > 3 && (
        <div className="border-2 border-white flex justify-center items-center transition-all duration-300 rounded-full p-1 first:p-0 bg-gray-300 dark:bg-gray-600 text-gray-900 dark:text-gray-100 h-10 w-10">
          +{users.length - 3}
        </div>
      )*/}
    </div>
  );
}

function getUserState(
  user: any,
): "offline" | "connected_treating" | "connected_free" | "inactive" {
  switch (user.status) {
    case "offline":
      return "offline";
    case "online":
      if (user.isTreating) {
        return "connected_treating";
      } else {
        return "connected_free";
      }
    default:
      return "inactive";
  }
}

function statusColor(user: any) {
  const user_state = getUserState(user);

  switch (user_state) {
    case "offline":
      return "bg-gray-500";
    case "connected_treating":
      return "bg-yellow-400";
    case "connected_free":
      return "bg-green-500";
    default:
      return "bg-red-500";
  }
}

function tooltipContent(user: any, dict: I18nRecord) {
  const user_state = getUserState(user);

  function formatTimeDifference(timestamp: string) {
    if (!timestamp) return "0";

    const diffMs = Date.now() - new Date(timestamp).getTime();

    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

    const parts = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);

    return parts.join(" ");
  }

  switch (user_state) {
    case "offline":
      return <div>Desconectado</div>;
    case "connected_treating":
      return (
        <div>
          <div className="w-full align-middle text-center font-normal">
            Conectado y tratando
          </div>
          <div className="w-full align-middle text-center font-light text-gray-500 dark:text-gray-400">
            hace {formatTimeDifference(user.start_timestamp)}
          </div>
          <hr className="my-2 border-gray-200 dark:border-gray-800" />
          <div className="w-full flex gap-2 justify-center items-center align-middle text-center font-light text-gray-500 dark:text-gray-400">
            <ConditionIcon
              condition={
                pin_conditions[user.icu_code as keyof typeof pin_conditions]
                  .icon
              }
              dict={dict}
              size="w-7 h-7"
            />
            <p className="text-gray-700 dark:text-gray-300">
              {user.trip_id ? user.trip_id : "Sin viaje"}
            </p>
          </div>
        </div>
      );
    case "connected_free":
      return (
        <div className="w-full align-middle text-center font-normal">
          <div>Conectado y libre</div>
          <div className="w-full align-middle text-center font-light text-gray-500 dark:text-gray-400">
            hace {formatTimeDifference(user.end_timestamp)}
          </div>
        </div>
      );
    default:
      return (
        <div className="w-full align-middle text-center font-normal">
          <div>Inactivo</div>
          <div className="w-full align-middle text-center font-light text-red-800 dark:text-red-300">
            hace {formatTimeDifference(user.end_timestamp)}
          </div>
        </div>
      );
  }
}
