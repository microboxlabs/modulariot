import TaskActions from "../task-actions/task-actions";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { taskShippingBoardMap } from "@/features/shipping/services/data.service";
import { TaskResponse } from "@/features/common/providers/alfresco-api/alfresco-api.types";
import DownloadSignedDocument from "@/features/shipping/components/download-signed-document/download-signed-document";
import { ShippingCoordinatorProcessFormsV2 } from "../../services/form.service.types";
import TimeElement from "./time-element";
import Link from "next/link";
import { Button } from "flowbite-react";
import { FaRegEye } from "react-icons/fa";
import { TaskOwnerDisplay } from "./task-owner-display";

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
  show_go_to_bento = false,
  userGroups = [],
}: {
  readonly task: TaskResponse;
  readonly dict: I18nRecord;
  readonly msg: I18nRecord;
  readonly lang: string;
  readonly showActions: boolean;
  readonly enableActions: boolean;
  readonly show_horeference?: boolean;
  readonly show_go_to_bento?: boolean;
  readonly userGroups?: string[];
}) {
  const task_name_identifier =
    taskShippingBoardMap[task.taskFormKey as ShippingCoordinatorProcessFormsV2];
  const writable_dict = (
    (dict.pages as unknown as I18nRecord).shipping as I18nRecord
  ).kanban as I18nRecord;

  const task_name = writable_dict[task_name_identifier];

  let title = "";

  if (task?.persistentState?.endTime) {
    title = tr("bento.titles.finished_process", dict);
  } else if (task_name) {
    title = task_name as string;
  }

  let subtitle = "";

  if (task?.persistentState?.endTime) {
    subtitle = tr("bento.titles.finished", dict);
  } else if (task_states[task_name_identifier as keyof typeof task_states]) {
    subtitle = tr(`bento.titles.${task_name_identifier}`, dict);
  }

  const workflowVersion = task.definitionVersion as number | undefined;

  return (
    <div className="bg-white dark:bg-gray-800 p-2 portrait:gap-2 flex flex-wrap items-center justify-between">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-md font-normal text-gray-700 dark:text-gray-200">
            {title}
          </h1>
          {workflowVersion && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
              v{workflowVersion}
            </span>
          )}
        </div>
        <div className="flex flex-row gap-2">
          {subtitle && (
            <h2 className="text-xs font-light text-gray-500 dark:text-gray-400">
              {tr("bento.process_state", dict)}:{" "}
              <span className="font-normal text-gray-800 dark:text-gray-200">
                {subtitle}
              </span>
            </h2>
          )}
          <TaskOwnerDisplay
            taskId={task.id}
            takenBy={task.takenBy ?? null}
            userGroups={userGroups}
            dict={dict.bento as Record<string, string>}
          />
        </div>
      </div>
      <div className="flex flex-row gap-1">
        <TimeElement
          task={task}
          dict={dict}
          endTime={task?.persistentState?.endTime}
        />
        {show_go_to_bento && (
          <Button color="blue" as={Link} href={`/task/edit/${task.id}`}>
            <div className="flex flex-row gap-2 items-center">
              <FaRegEye className="text-gray-100 w-5 h-5" />
              <p className="text-sm text-gray-100 lg:block hidden whitespace-nowrap">
                {tr("bento.go_to_bento", dict)}
              </p>
            </div>
          </Button>
        )}
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
            taskType={task.taskFormKey as ShippingCoordinatorProcessFormsV2}
            lang={lang}
            dict={msg}
            fluid={true}
            enableActions={enableActions}
            extraData={task}
          />
        )}
      </div>
    </div>
  );
}
