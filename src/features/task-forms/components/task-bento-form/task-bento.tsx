import "server-only";

import {
  TYPE_WFSHIP2_ASSIGN_DRIVER_TASK,
  TYPE_WFSHIP2_PRESENT_DRIVER_TASK,
  TYPE_WFSHIP2_PREPARE_SERVICE_TASK,
  TYPE_WFSHIP2_MISSION_CONTROL_TASK,
  TYPE_WFSHIP2_MONITOR_TRIP_TASK,
  TYPE_WFSHIP2_CONFIRM_ARRIVAL_TASK,
  TYPE_WFSHIP2_CLOSE_MONITORING_TASK,
  TYPE_WFDELIVERY_RECEIVE_DELIVERY_TASK,
} from "../../services/form.service";
import { ExtendedTaskViewProps } from "../task-form/task-form.types";
import { getDictionary } from "@/features/i18n/i18n.service";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { defaultLocale } from "@/features/i18n/tr.service";
import Bento from "./bento";
import { TaskResponse } from "@/features/common/providers/alfresco-api/alfresco-api.types";

export async function TaskBentoForm({
  task,
  lang,
  userGroups,
  active = true,
}: ExtendedTaskViewProps) {
  const [_dict, dictionary] = await getDictionary(lang ?? defaultLocale);

  // Handle historical tasks
  if (task?.persistentState?.endTime) {
    switch (task.taskFormKey) {
      default:
        return (
          <Bento
            lang={lang ?? defaultLocale}
            task={task as TaskResponse}
            userGroups={userGroups}
            dict={dictionary as I18nRecord}
            msg={
              (dictionary.pages as I18nRecord)
                .transportValidationForm as I18nRecord
            }
            active={active}
            showActions={false}
          />
        );
    }
  }

  switch (task?.taskFormKey) {
    case TYPE_WFSHIP2_ASSIGN_DRIVER_TASK: /* V2 Tasks */
    case TYPE_WFSHIP2_PRESENT_DRIVER_TASK:
    case TYPE_WFSHIP2_PREPARE_SERVICE_TASK:
    case TYPE_WFSHIP2_MISSION_CONTROL_TASK:
    case TYPE_WFSHIP2_MONITOR_TRIP_TASK:
    case TYPE_WFSHIP2_CLOSE_MONITORING_TASK:
    case TYPE_WFSHIP2_CONFIRM_ARRIVAL_TASK:
      return (
        <Bento
          lang={lang ?? defaultLocale}
          task={task as TaskResponse}
          userGroups={userGroups}
          dict={dictionary as I18nRecord}
          msg={
            (dictionary.pages as I18nRecord)
              .shippingDetailsTaskForm as I18nRecord
          }
          active={active}
        />
      );

    case TYPE_WFDELIVERY_RECEIVE_DELIVERY_TASK:
      //TODO: Add task.mintral_executionType === "T"
      return (
        <Bento
          lang={lang ?? defaultLocale}
          task={task as TaskResponse}
          userGroups={userGroups}
          dict={dictionary as I18nRecord}
          msg={
            (dictionary.pages as I18nRecord)
              .transportValidationForm as I18nRecord
          }
          active={active}
        />
      );
    default:
      return (
        <Bento
          lang={lang ?? defaultLocale}
          task={task as TaskResponse}
          userGroups={userGroups}
          dict={dictionary as I18nRecord}
          msg={
            (dictionary.pages as I18nRecord)
              .transportValidationForm as I18nRecord
          }
          active={active}
        />
      );
  }
}
