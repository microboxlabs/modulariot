"use client";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { TaskResponse } from "@/features/common/providers/alfresco-api/alfresco-api.types";
import TripInformation from "./components/trip-information/trip-information";
import TaskActions from "../task-actions/task-actions";
import { Button } from "flowbite-react";
import { FaRegFilePdf } from "react-icons/fa";
import { GoClockFill } from "react-icons/go";
import { MdWindow } from "react-icons/md";
import DriverInfo from "./components/driver/driver";
import { GeographicHistoric } from "@/features/shipping/components/geographic-historic";
import { ShippingCoordinatorProcessForms } from "../../services/form.service.types";
import SideData from "./components/side-data/side-data";

export default function Bento({
  lang,
  task,
  user,
  userGroups,
  msg,
  active,
}: {
  lang: string;
  task: TaskResponse;
  user: string;
  userGroups: string[];
  msg: I18nRecord;
  active: boolean;
}) {
  console.log(task);

  

  console.log(msg);

  return (
    <div className="flex flex-col w-full h-full ">
      {/* Head */}
      <div className="bg-white dark:bg-gray-800 p-2 portrait:gap-2 flex flex-wrap justify-between">
        <div>
          <h1 className="text-md font-normal text-gray-700 dark:text-gray-200">
            Asignar Conductor/Transporte
          </h1>
          <h2 className="text-xs font-light text-gray-500 dark:text-gray-400">
            Estado de Proceso: Planificado
          </h2>
        </div>
        <div className="flex flex-row gap-1 w-full sm:w-auto">
          <Button
            color="gray"
            className="h-10 transition-all duration-100 z-20 bg-white dark:bg-gray-800 gap-2 w-fit hover:text-gray-500 portrait:hidden"
          >
            <div className="flex flex-row gap-2 items-center">
              <MdWindow className="w-5 h-5" width={30} height={30} />
            </div>
          </Button>
          <Button
            color="gray"
            className="h-10 transition-all duration-100 z-20 bg-white dark:bg-gray-800 gap-2 w-fit hover:text-gray-500"
          >
            <div className="flex flex-row gap-2 items-center">
              <GoClockFill className="w-5 h-5" width={30} height={30} />
              <p className="text-sm text-gray-900 dark:text-gray-100 lg:block hidden whitespace-nowrap">
                00:00:00
              </p>
            </div>
          </Button>
          <Button
            color="gray"
            className="h-10 transition-all duration-100 z-20 bg-white dark:bg-gray-800 gap-2 w-fit"
          >
            <div className="flex flex-row gap-2 items-center">
              <FaRegFilePdf className="w-5 h-5" width={20} height={20} />
              <p className="text-sm text-gray-900 dark:text-gray-100 lg:block hidden whitespace-nowrap">
                Carta Porte
              </p>
            </div>
          </Button>
          <TaskActions
            dict={(msg.pages as I18nRecord).transportValidationForm as I18nRecord}
            taskId={task.id}
            taskType={task.taskFormKey as ShippingCoordinatorProcessForms}
            lang={lang}
            fluid={true}
          />
        </div>
      </div>
      {/* Head */}

      {/* Fixed Content */}
      <div className="grid grid-cols-3 gap-2 p-2">
        <div className="col-span-1 row-span-1 w-full h-96 bg-gray-100 dark:bg-gray-800 rounded-lg p-2 border border-gray-300 dark:border-gray-700">
          Trip information
        </div>
        <div className="col-span-1 w-full h-96 bg-gray-100 dark:bg-gray-800 rounded-lg p-2 border border-gray-300 dark:border-gray-700">
          Driver information
        </div>
        <div className="row-start-1 row-end-5 col-start-3 col-end-3 w-full bg-gray-100 dark:bg-gray-800 rounded-lg p-2 border border-gray-300 dark:border-gray-700">
          AAAAA
        </div>
        <div className="row-start-2 row-end-5 col-start-1 col-end-3 w-full bg-gray-100 dark:bg-gray-800 rounded-lg p-2 border border-gray-300 dark:border-gray-700">
          Map
        </div>
        
      </div>
      {/* Fixed Content */}



      {/* Content */}
      <div className="flex flex-row flex-wrap gap-2 p-2 overflow-y-auto flex-grow w-full">
        <div className="flex gap-2 flex-col flex-1 portrait:w-full">
          <div className="flex flex-wrap gap-2 h-fit w-full">
            <TripInformation
              task={task}
              msg={msg}
              lang={lang}
              userGroups={userGroups}
            />
            <DriverInfo task={task} msg={msg} />
          </div>
          <div className="w-full portrait:h-[300px]  flex flex-grow">
            <GeographicHistoric
              task={task as TaskResponse}
              dictionary={msg as Record<string, string>}
              active={active}
            />
          </div>
        </div>
        <SideData dict={msg as I18nRecord} />
      </div>
    </div>
  );
}
