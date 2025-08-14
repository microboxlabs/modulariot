import "server-only";

import {
  TYPE_WFSHIP_TRANSPORT_VALIDATION_TASK,
  TYPE_WFSHIP_MISSION_CONTROL_TRIP_INIT_TASK,
  TYPE_WFSHIP_OVERLORD_TRIP_INIT_TASK,
  TYPE_WFSHIP_SOVOS_DIGITAL_SIGNATURE,
  TYPE_WFSHIP_TRIP_OUTSIDE_INITIATED_TASK,
  TYPE_WFSHIP_MONITORING_IN_COURSE_TRIP,
  TYPE_WFSHIP_CONFIRM_DELIVERY,
  TYPE_WFSHIP_CONFIRM_TRIP_DESTINATION_DEPARTURE,
  TYPE_WFSHIP_CONFIRM_TRIP_DESTINATION_ARRIVAL,
  TYPE_WFSHIP_CONFIRM_MONITORING_FINALIZATION,
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
import { getUserProfile } from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import Bento from "./bento";
import TransportValidationForm from "../transport-validation-form/transport-validation-form";
import { TaskResponse } from "@/features/common/providers/alfresco-api/alfresco-api.types";
import SovosVerificationForm from "../sovos-verification-form/sovos-verification-form";
import MissionControlTripInitForm from "../mission-control-trip-init-form/mission-control-trip-init-form";
import ShippingDetailsTaskForm from "../shipping-details-task-form/shipping-details-task-form";
import ConfirmDeliveryForm from "../confirm-delivery-form/confirm-delivery-form";

export async function TaskBentoForm({
  task,
  lang,
  session,
  userGroups,
  active = true,
}: ExtendedTaskViewProps) {
  const [_dict, dictionary] = await getDictionary(lang ?? defaultLocale);
  const userInstance = await getUserProfile(session);
  const user = JSON.stringify(userInstance);

  /* 
  return (
    <Bento
      lang={lang ?? defaultLocale}
      task={task as any}
      user={user}
      userGroups={userGroups}
      msg={dictionary as I18nRecord}
      active={active}
    />
  );
  */

  // Handle historical tasks
  if (task?.persistentState?.endTime) {
    switch (task.taskFormKey) {
      default:
        return (
          <Bento
            lang={lang ?? defaultLocale}
            task={task as any}
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
    case TYPE_WFSHIP_TRANSPORT_VALIDATION_TASK:
      return (
        <TransportValidationForm
          lang={lang}
          task={task as TaskResponse}
          user={user}
          userGroups={userGroups}
          msg={dictionary as I18nRecord}
        />
      );

    case TYPE_WFSHIP_SOVOS_DIGITAL_SIGNATURE:
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
    case TYPE_WFSHIP_MISSION_CONTROL_TRIP_INIT_TASK:
      return (
        <MissionControlTripInitForm
          lang={lang}
          task={task as TaskResponse}
          user={user}
          userGroups={userGroups}
          msg={dictionary as I18nRecord}
        />
      );
    case TYPE_WFSHIP_TRIP_OUTSIDE_INITIATED_TASK:
      return (
        <ShippingDetailsTaskForm
          lang={lang}
          task={task as TaskResponse}
          user={user}
          userGroups={userGroups}
        />
      );

    case TYPE_WFSHIP_OVERLORD_TRIP_INIT_TASK:
    case TYPE_WFSHIP_MONITORING_IN_COURSE_TRIP:
    case TYPE_WFSHIP_CONFIRM_TRIP_DESTINATION_ARRIVAL:
    case TYPE_WFSHIP_CONFIRM_TRIP_DESTINATION_DEPARTURE:
    case TYPE_WFSHIP_CONFIRM_MONITORING_FINALIZATION:
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
          task={task as any}
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
          task={task as any}
          userGroups={userGroups}
          dict={dictionary as I18nRecord}
          msg={
            (dictionary.pages as I18nRecord)
              .transportValidationForm as I18nRecord
          }
          active={active}
        />
      );
    case TYPE_WFSHIP_CONFIRM_DELIVERY:
      if (task.mintral_executionType === "T") {
        return (
          <ConfirmDeliveryForm
            lang={lang ?? defaultLocale}
            task={task as TaskResponse}
            user={user}
            userGroups={userGroups}
            msg={
              (dictionary.pages as I18nRecord)
                .sovosVerificationForm as I18nRecord
            }
          />
        );
      }

      return (
        <Bento
          lang={lang ?? defaultLocale}
          task={task as any}
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
          task={task as any}
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
