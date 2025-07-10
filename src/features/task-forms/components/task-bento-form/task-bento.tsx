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
import TransportValidationForm from "../transport-validation-form/transport-validation-form";
import { ExtendedTaskViewProps } from "../task-form/task-form.types";
import { getDictionary } from "@/features/i18n/i18n.service";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { defaultLocale } from "@/features/i18n/tr.service";
import ShippingDetailsTaskForm from "../shipping-details-task-form/shipping-details-task-form";
import SovosVerificationForm from "../sovos-verification-form/sovos-verification-form";
import { getUserProfile } from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import MissionControlTripInitForm from "../mission-control-trip-init-form/mission-control-trip-init-form";
import { TaskResponse } from "@/features/common/providers/alfresco-api/alfresco-api.types";
import { GeneralTripView } from "@/features/shipping/components/general-trip-view/general-trip-view";
import { NextCancelTripView } from "@/features/shipping/components/next-cancel-trip-view/next-cancel-trip-view";
import ConfirmDeliveryForm from "../confirm-delivery-form/confirm-delivery-form";
import Bento from "./bento";

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
  The important data here is the task, this will define generally what our form will be showing
  after that user and user groups are used to define permissions for users so they can (or cant)
  actuate with certain elements in the form.

  This development mainly exchanges the elements shown behind for a bento box component
  */

  return (
    <Bento
      lang={lang ?? defaultLocale}
      task={task as any}
      user={user}
      userGroups={userGroups}
      msg={
        dictionary as I18nRecord
      }
      active={active}
    />
  );
}
