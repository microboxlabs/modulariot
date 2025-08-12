import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { TaskResponse } from "@/features/common/providers/alfresco-api/alfresco-api.types";
import TripInformation from "./components/trip-information/trip-information";
import DriverInfo from "./components/driver/driver";
// import Conditions from "./components/side-data/conditions";
import Geographic from "@/features/shipping/components/geographic";
import HistoricLoads from "@/features/shipping/components/historic-loads";

import Comment from "./components/side-data/comment";
import { ExtendedTaskResponse } from "../task-form/task-form.types";
import ValidationsInfo from "./components/driver/validations";
import FileImages from "./components/side-data/multimedia-manager.tsx/file-images";
import SymptomsCard from "./components/side-data/symptoms-card";
import BentoHead from "./bento-head";
// import Forum from "./components/forum/forum";
import DownloadSignedDocument from "@/features/shipping/components/download-signed-document/download-signed-document";
import TaskActions from "../task-actions/task-actions";
import { ShippingCoordinatorProcessForms } from "../../services/form.service.types";
import { taskShippingBoardMap } from "@/features/shipping/services/data.service";
import TimeElement from "./time-element";
import { tr } from "@/features/i18n/tr.service";
import ValidationsInfo from "./components/driver/validations";
import FileImages from "./components/side-data/multimedia-manager.tsx/file-images";
import SymptomsCard from "./components/side-data/symptoms-card";
import Forum from "./components/forum/forum";

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
  return (
    <div className="flex flex-col w-full h-full ">
      {/* Head */}
      <BentoHead
        task={task}
        dict={dict}
        msg={msg}
        lang={lang}
        showActions={showActions}
        enableActions={enableActions}
      />
      {/* Head */}

      {/* Content */}
      <div className="gap-2 p-2 bg-gray-50 dark:bg-gray-900 h-fit grid grid-cols-1 lg:grid-cols-3">
        {/* Trip Information and Driver Info - side by side on portrait, separate on landscape */}
        <div className="col-span-2 flex flex-wrap flex-col md:flex-row gap-2">
          {/* Trip Information */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700 flex-grow w-full lg:w-fit">
            <TripInformation
              task={task}
              msg={dict}
              /* lang={lang}
              userGroups={userGroups} */
            />
          </div>

          {/* Driver Info */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700 flex-grow w-full md:w-fit">
            <DriverInfo task={task} msg={dict} />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700 col-span-2 lg:col-span-1">
          <ValidationsInfo
            task={task}
            msg={dict}
            lang={lang}
            userGroups={userGroups}
          />
        </div>

        {/* Geographic - spans full width below trip/driver on portrait, 2 columns on landscape */}
        <div className="col-span-2 bg-white dark:bg-gray-800 rounded-lg overflow-hidden sm:border border-gray-300 dark:border-gray-700 sm:min-h-[343px] min-h-fit hidden lg:flex">
          <div className="h-full w-full">
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

        {/* File Images */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-2 border border-gray-300 dark:border-gray-700 col-span-2 lg:col-span-1">
          <FileImages task={task} dictionary={dict as I18nRecord} />
        </div>

        {/* Historic Loads - spans full width */}
        <div className="col-span-2 bg-white dark:bg-gray-800 rounded-lg min-h-[300px]">
          <HistoricLoads
            task={task}
            dictionary={dict as unknown as Record<string, string>}
            active={active}
          />
        </div>

        {/* Conditions */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700 overflow-hidden col-span-2 lg:col-span-1">
          {/* <Conditions dict={dict as I18nRecord} task={task} /> */}
          <SymptomsCard task={task} dict={dict as I18nRecord} />
        </div>

        {/* Forum */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700 overflow-hidden col-span-2 h-[400px]">
          <Forum dict={dict as I18nRecord} />
        </div>
      </div>
      {/* Content */}
    </div>
  );
}
