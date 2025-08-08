import TaskActions from "../task-actions/task-actions";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { taskShippingBoardMap } from "@/features/shipping/services/data.service";
import { TaskResponse } from "@/features/common/providers/alfresco-api/alfresco-api.types";
import DownloadSignedDocument from "@/features/shipping/components/download-signed-document/download-signed-document";
import { ShippingCoordinatorProcessForms } from "../../services/form.service.types";
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

export default function BentoHead({
  task,
  dict,
  msg,
  lang,
  showActions,
  enableActions,
  show_horeference = true,
}: {
  readonly task: TaskResponse;
  readonly dict: I18nRecord;
  readonly msg: I18nRecord;
  readonly lang: string;
  readonly showActions: boolean;
  readonly enableActions: boolean;
  readonly show_horeference?: boolean;
}) {
  const task_name_identifier =
    taskShippingBoardMap[task.taskFormKey as ShippingCoordinatorProcessForms];
  const writable_dict = (
    (dict.pages as unknown as I18nRecord).shipping as I18nRecord
  ).kanban as I18nRecord;

  const task_name = writable_dict[task_name_identifier];

  let title = "";

  if (task?.persistentState?.endTime) {
    title = tr(
      "finished_process",
      (dict.bento as I18nRecord).titles as I18nRecord,
    );
  } else if (task_name) {
    title = tr(
      task_name as string,
      (dict.bento as I18nRecord).titles as I18nRecord,
    );
  }

  let subtitle = "";

  if (task?.persistentState?.endTime) {
    subtitle = tr("finished", (dict.bento as I18nRecord).titles as I18nRecord);
  } else if (Object.values(task_states).includes(task_name_identifier)) {
    subtitle = tr(
      task_states[task_name_identifier as keyof typeof task_states] as string,
      (dict.bento as I18nRecord).titles as I18nRecord,
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 p-2 portrait:gap-2 flex flex-wrap items-center justify-between">
      <div>
        <h1 className="text-md font-normal text-gray-700 dark:text-gray-200">
          {title}
        </h1>
        <div className="flex flex-row gap-2">
          {subtitle && (
            <h2 className="text-xs font-light text-gray-500 dark:text-gray-400">
              {(dict.bento as I18nRecord).process_state as string}:{" "}
              <span className="font-normal text-gray-800 dark:text-gray-200">
                {subtitle}
              </span>
            </h2>
          )}
          {task.takenBy && (
            <h2 className="text-xs font-light text-gray-500 dark:text-gray-400">
              {(dict.bento as I18nRecord).taken_by as string}:{" "}
              <span className="font-normal text-gray-800 dark:text-gray-200">
                {task.takenBy}
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
          task={task}
          dict={dict}
          endTime={task?.persistentState?.endTime}
        />
        {task.mintral_hoReference && show_horeference && (
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
  );
}
