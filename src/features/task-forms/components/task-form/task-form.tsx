import "server-only";

import {
  TYPE_WFSHIP2_ASSIGN_DRIVER_TASK,
  TYPE_WFSHIP2_PRESENT_DRIVER_TASK,
  TYPE_WFSHIP2_PREPARE_SERVICE_TASK,
  TYPE_WFSHIP2_MISSION_CONTROL_TASK,
  TYPE_WFSHIP2_MONITOR_TRIP_TASK,
  TYPE_WFSHIP2_CONFIRM_ARRIVAL_TASK,
  TYPE_WFSHIP2_CLOSE_MONITORING_TASK,
  TYPE_WFDELIVERY_CONFIRM_DELIVERY_TASK,
  TYPE_WFDELIVERY_RECEIVE_DELIVERY_TASK,
  TYPE_WFDELIVERY_NOTIFY_TMS_ARRIVAL_TASK,
  TYPE_WFDELIVERY_NOTIFY_TMS_DELIVERY_TASK,
} from "../../services/form.service";
import { ExtendedTaskViewProps } from "./task-form.types";
import { getDictionary } from "@/features/i18n/i18n.service";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { defaultLocale } from "@/features/i18n/tr.service";
import SovosVerificationForm from "../sovos-verification-form/sovos-verification-form";
import { getUserProfile } from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import { TaskResponse } from "@/features/common/providers/alfresco-api/alfresco-api.types";
import { GeneralTripView } from "@/features/shipping/components/general-trip-view/general-trip-view";
import { NextCancelTripView } from "@/features/shipping/components/next-cancel-trip-view/next-cancel-trip-view";

export async function TaskForm({
  task,
  lang,
  userGroups,
  active = true,
  session,
}: ExtendedTaskViewProps) {
  const [_dict, dictionary] = await getDictionary(lang ?? defaultLocale);
  const userInstance = await getUserProfile(session!, "-me-");
  const user = JSON.stringify(userInstance);

  // Handle historical tasks
  if (task?.persistentState?.endTime) {
    switch (task.taskFormKey) {
      default:
        return (
          <GeneralTripView
            session={session}
            lang={lang ?? defaultLocale}
            task={task}
            user={user}
            userGroups={userGroups}
            msg={
              (dictionary.pages as I18nRecord)
                .transportValidationForm as I18nRecord
            }
            active={active}
          />
        );
    }
  }

  switch (task?.taskFormKey) {
    case TYPE_WFSHIP2_PRESENT_DRIVER_TASK:
      return (
        <SovosVerificationForm
          lang={lang}
          task={task as TaskResponse}
          user={user}
          userGroups={userGroups}
          msg={
            (dictionary.pages as I18nRecord).sovosVerificationForm as I18nRecord
          }
        />
      );

    case TYPE_WFSHIP2_ASSIGN_DRIVER_TASK: /* V2 Tasks */
    case TYPE_WFSHIP2_PREPARE_SERVICE_TASK: /* case TYPE_WFSHIP2_PRESENT_DRIVER_TASK: */
    case TYPE_WFSHIP2_MISSION_CONTROL_TASK:
    case TYPE_WFSHIP2_MONITOR_TRIP_TASK:
    case TYPE_WFSHIP2_CONFIRM_ARRIVAL_TASK:
    case TYPE_WFSHIP2_CLOSE_MONITORING_TASK:
    case TYPE_WFDELIVERY_CONFIRM_DELIVERY_TASK: /* Delivery Process */
    case TYPE_WFDELIVERY_RECEIVE_DELIVERY_TASK:
    case TYPE_WFDELIVERY_NOTIFY_TMS_ARRIVAL_TASK:
    case TYPE_WFDELIVERY_NOTIFY_TMS_DELIVERY_TASK:
      return (
        <NextCancelTripView
          session={session}
          lang={lang ?? defaultLocale}
          task={task}
          user={user}
          userGroups={userGroups}
          msg={
            (dictionary.pages as I18nRecord)
              .transportValidationForm as I18nRecord
          }
        />
      );

    default:
      return (
        <GeneralTripView
          session={session}
          lang={lang ?? defaultLocale}
          task={task}
          user={user}
          userGroups={userGroups}
          msg={
            (dictionary.pages as I18nRecord)
              .transportValidationForm as I18nRecord
          }
        />
      );
  }
}
