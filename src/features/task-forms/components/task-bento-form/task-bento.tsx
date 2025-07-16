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
import { NextCancelTripView } from "@/features/shipping/components/next-cancel-trip-view/next-cancel-trip-view";
import ConfirmDeliveryForm from "../confirm-delivery-form/confirm-delivery-form";

export async function TaskBentoForm({
  task,
  lang,
  ticket,
  userGroups,
  active = true,
}: ExtendedTaskViewProps) {
  const [_dict, dictionary] = await getDictionary(lang ?? defaultLocale);
  const userInstance = await getUserProfile(ticket!);
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
            msg={dictionary as I18nRecord}
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
      return (
        <Bento
          lang={lang ?? defaultLocale}
          task={task as any}
          userGroups={userGroups}
          msg={dictionary}
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
        <NextCancelTripView
          lang={lang ?? defaultLocale}
          task={task}
          user={user}
          userGroups={userGroups}
          msg={dictionary as I18nRecord}
        />
      );
    default:
      return (
        <Bento
          lang={lang ?? defaultLocale}
          task={task as any}
          userGroups={userGroups}
          msg={dictionary as I18nRecord}
          active={active}
        />
      );
  }
}
