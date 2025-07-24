"use client";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { TaskResponse } from "@/features/common/providers/alfresco-api/alfresco-api.types";
import TripInformation from "./components/trip-information/trip-information";
import DriverInfo from "./components/driver/driver";
import Conditions from "./components/side-data/conditions";
import Geographic from "@/features/shipping/components/geographic";
import HistoricLoads from "@/features/shipping/components/historic-loads";
import ImageViewer from "@/features/geographic-view/components/image-viewer/image-viewer";
import { useState } from "react";
import DownloadSignedDocument from "@/features/shipping/components/download-signed-document/download-signed-document";
import TaskActions from "../task-actions/task-actions";
import { ShippingCoordinatorProcessForms } from "../../services/form.service.types";
import { useGetConditions } from "./hooks/use-get-conditions";
import { taskShippingBoardMap } from "@/features/shipping/services/data.service";
import Comment from "./components/side-data/comment";
import { ExtendedTaskResponse } from "../task-form/task-form.types";
import TimeElement from "./time-element";

const task_states = {
  assignDriver: "planificado",
  presentDriver: "asignado",
  prepareService: "en_preparacion",
  missionControl: "preparado",
  monitorTrip: "iniciado",
  confirmArrival: "arribado_sp",
  closeMonitoring: "arribado_cp",
  confirmDelivery: "arribado_sp",
  receiveDelivery: "arribado_cp",
  notifyTMSArrival: "recepcionado",
  notifyTMSDelivery: "recepcionado",
};

/*
"assignDriver": "Asignar Conductor y Transporte",
"presentDriver": "Presentar Conductor",
"prepareService": "Preparar Servicio",
"missionControl": "Iniciar viaje"
"monitorTrip": "Monitorear Viaje Iniciado",
"confirmArrival": "Confirmar Arribo a Destino",
"closeMonitoring": "Confirmar Cierre de Monitoreo",
*/

export default function Bento({
  lang,
  task,
  userGroups,
  dict, // this is the general dictionary to base all our code
  msg, // this is a relative dictionary for the current task
  active = true,
  enableActions = false,
  showActions = true,
}: {
  lang: string;
  task: TaskResponse;
  userGroups: string[];
  dict: I18nRecord;
  msg: I18nRecord;
  active?: boolean;
  enableActions?: boolean;
  showActions?: boolean;
}) {
  const [selectedImage, setSelectedImage] = useState<number | null>(null);

  const testImages = [
    "https://mintcargaimagenesprbfc3.blob.core.windows.net/mintral-catalogo-imagenes-prd/viaje/1484826/alerta_estiba/c9231598_1748475008514.jpeg",
    "https://mintcargaimagenesprbfc3.blob.core.windows.net/mintral-catalogo-imagenes-prd/viaje/1484826/alerta_estiba/c9231598_1748475008514.jpeg",
    "https://mintcargaimagenesprbfc3.blob.core.windows.net/mintral-catalogo-imagenes-prd/viaje/1484826/alerta_estiba/c9231598_1748475008514.jpeg",
    "https://mintcargaimagenesprbfc3.blob.core.windows.net/mintral-catalogo-imagenes-prd/viaje/1484826/alerta_estiba/c9231598_1748475008514.jpeg",
    "https://mintcargaimagenesprbfc3.blob.core.windows.net/mintral-catalogo-imagenes-prd/viaje/1484826/alerta_estiba/c9231598_1748475008514.jpeg",
  ];

  const { data: conditions, isLoading: isLoadingConditions } = useGetConditions(
    task.id,
  );

  const task_name_identifier =
    taskShippingBoardMap[task.taskFormKey as ShippingCoordinatorProcessForms];
  const writable_dict = (
    (dict.pages as unknown as I18nRecord).shipping as I18nRecord
  ).kanban as I18nRecord;

  const task_name = writable_dict[task_name_identifier];
  const title = task?.persistentState?.endTime
    ? ((
        ((dict.pages as unknown as I18nRecord).shipping as I18nRecord)
          .kanban as I18nRecord
      ).finished_process as string)
    : (task_name as string);
  const subtitle = task?.persistentState?.endTime
    ? (
        ((dict.pages as unknown as I18nRecord).shipping as I18nRecord)
          .kanban as I18nRecord
      ).finished
    : ((dict.bento as I18nRecord)[
        task_states[task_name_identifier as keyof typeof task_states] as string
      ] as string);

  return (
    <div className="flex flex-col w-full h-full ">
      {/* Head */}
      <div className="bg-white dark:bg-gray-800 p-2 portrait:gap-2 flex flex-wrap items-center justify-between">
        <div>
          <h1 className="text-md font-normal text-gray-700 dark:text-gray-200">
            {title as string}
          </h1>
          <div className="flex flex-row gap-2">
            {subtitle && (
              <h2 className="text-xs font-light text-gray-500 dark:text-gray-400">
                {(dict.bento as I18nRecord).process_state as string}:{" "}
                <span className="font-normal text-gray-800 dark:text-gray-200">
                  {subtitle as string}
                </span>
              </h2>
            )}
            {task.takenBy && (
              <h2 className="text-xs font-light text-gray-500 dark:text-gray-400">
                {(dict.bento as I18nRecord).taken_by as string}:{" "}
                <span className="font-normal text-gray-800 dark:text-gray-200">
                  {task.takenBy as string}
                </span>
              </h2>
            )}
          </div>
        </div>
        <div className="flex flex-row gap-1 w-full sm:w-auto">
          {/*          
          <Button
            color="gray"
            className="h-10 transition-all duration-100 bg-white dark:bg-gray-800 gap-2 w-fit hover:text-gray-500 portrait:hidden"
          >
            <div className="flex flex-row gap-2 items-center">
              <MdWindow className="w-5 h-5" width={30} height={30} />
            </div>
          </Button>
          */}
          <TimeElement
            task={task as TaskResponse}
            dict={dict as I18nRecord}
            endTime={task?.persistentState?.endTime}
          />
          {task.mintral_hoReference && (
            <DownloadSignedDocument
              documentId={task.mintral_hoReference}
              asLink
              name="Carta Porte"
            />
          )}

          {showActions && task.isEditable && (
            <TaskActions
              taskId={task.id}
              taskType={task.taskFormKey as ShippingCoordinatorProcessForms}
              lang={lang}
              dict={msg}
              fluid={true}
              enableActions={enableActions}
            />
          )}
        </div>
      </div>
      {/* Head */}

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2 p-2 bg-gray-50 dark:bg-gray-900 h-fit">
        {/* Trip Information and Driver Info - side by side on portrait, separate on landscape */}
        <div className="lg:col-span-2 flex flex-wrap flex-col md:flex-row gap-2">
          {/* Trip Information */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700 flex-grow w-full lg:w-fit">
            <TripInformation
              task={task}
              msg={dict}
              lang={lang}
              userGroups={userGroups}
            />
          </div>

          {/* Driver Info */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700 flex-grow w-full md:w-fit">
            <DriverInfo task={task} msg={dict} />
          </div>
        </div>

        {/* Conditions */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700">
          <Comment
            task={task as ExtendedTaskResponse}
            dict={dict as I18nRecord}
          />
        </div>

        {/* Geographic - spans full width below trip/driver on portrait, 2 columns on landscape */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-lg overflow-hidden sm:border border-gray-300 dark:border-gray-700 sm:min-h-[343px] min-h-fit">
          <div className="h-full w-full hidden sm:flex">
            <Geographic
              task={task}
              dictionary={dict as unknown as Record<string, string>}
            />
          </div>
          {/*
            <div className="rounded-lg overflow-hidden sm:hidden bg-white dark:bg-gray-800">
              <Button className="w-full h-full" color="gray">
                <div className="flex flex-row gap-2 items-center">
                  <FaMapPin />
                  Abrir mapa
                </div>
              </Button>
            </div>
          */}
        </div>

        {/* Conditions */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700 overflow-hidden">
          <Conditions
            dict={dict as I18nRecord}
            conditions={conditions}
            isLoading={isLoadingConditions}
          />
        </div>

        {/* File Images */}
        {/*
          <div className="bg-white dark:bg-gray-800 rounded-lg p-2 border border-gray-300 dark:border-gray-700">
            <FileImages
              images={testImages.slice(0, 4)}
              setSelectedImage={setSelectedImage}
            />
          </div>
        */}

        {/* Historic Loads - spans full width */}
        <div className="lg:col-span-3 bg-white dark:bg-gray-800 rounded-lg min-h-[300px]">
          <HistoricLoads
            task={task}
            dictionary={dict as unknown as Record<string, string>}
            active={active}
          />
        </div>

        {/* Forum */}
        {/*
          <div className=" bg-white dark:bg-gray-800 rounded-lg overflow-hidden border border-gray-300 dark:border-gray-700">
            <div className="flex flex-col items-center justify-center h-full scale-90">
              <EmptyAnimation />
            </div>
          </div>
        */}
      </div>
      {/* Content */}

      {/* Image Viewer */}
      <ImageViewer
        images={testImages}
        selected={selectedImage}
        setSelected={setSelectedImage}
      />
    </div>
  );
}
