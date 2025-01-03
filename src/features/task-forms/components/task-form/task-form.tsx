import "server-only";

import {
  TYPE_WFSHIP_TRANSPORT_VALIDATION_TASK,
  TYPE_WFSHIP_MISSION_CONTROL_TRIP_INIT_TASK,
  TYPE_WFSHIP_OVERLORD_TRIP_INIT_TASK,
  TYPE_WFSHIP_SOVOS_DIGITAL_SIGNATURE,
  TYPE_WFSHIP_TRIP_OUTSIDE_INITIATED_TASK,
  OUTCOME_TRIP_INITIATED,
  OUTCOME_TRIP_CANCELED,
  OUTCOME_TRIP_ANNULLED,
} from "../../services/form.service";
import TransportValidationForm from "../transport-validation-form/transport-validation-form";
import { TaskFormProps } from "./task-form.types";
import { notFound } from "next/navigation";
import { getDictionary } from "@/features/i18n/i18n.service";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { defaultLocale } from "@/features/i18n/tr.service";
import ShippingDetailsTaskForm from "../shipping-details-task-form/shipping-details-task-form";
import SovosVerificationForm from "../sovos-verification-form/sovos-verification-form";
import { getUserProfile } from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import MissionControlTripInitForm from "../mission-control-trip-init-form/mission-control-trip-init-form";
import {
  CancelledTripView,
  CompletedTripView,
  GeneralTripView,
  VoidedTripView,
} from "@/features/shipping/components/historical-task-views";

export async function TaskForm({ task, lang, ticket }: TaskFormProps) {
  const [_dict, dictionary] = await getDictionary(lang ?? defaultLocale);
  const userInstance = await getUserProfile(ticket!);
  const user = JSON.stringify(userInstance);
  console.log("task", task);

  // Handle historical tasks
  if (task?.persistentState?.endTime) {
    switch (task.taskFormKey) {
      case OUTCOME_TRIP_INITIATED: //TYPE_WFSHIP_COMPLETED_TRIP:
        return (
          <CompletedTripView
            lang={lang ?? defaultLocale}
            task={task}
            user={user}
            msg={(dictionary.pages as I18nRecord).completedTrip as I18nRecord}
          />
        );
      case OUTCOME_TRIP_CANCELED: //TYPE_WFSHIP_CANCELLED_TRIP:
        return (
          <CancelledTripView
            lang={lang ?? defaultLocale}
            task={task}
            user={user}
            msg={(dictionary.pages as I18nRecord).cancelledTrip as I18nRecord}
          />
        );
      case OUTCOME_TRIP_ANNULLED: //TYPE_WFSHIP_VOIDED_TRIP:
        return (
          <VoidedTripView
            lang={lang ?? defaultLocale}
            task={task}
            user={user}
            msg={(dictionary.pages as I18nRecord).voidedTrip as I18nRecord}
          />
        );
      default:
        return (
          <GeneralTripView
            lang={lang ?? defaultLocale}
            task={task}
            user={user}
            msg={
              (dictionary.pages as I18nRecord).historicalTaskView as I18nRecord
            }
          />
        );
    }
  }

  switch (task?.taskFormKey) {
    case TYPE_WFSHIP_TRANSPORT_VALIDATION_TASK:
      return (
        <TransportValidationForm
          lang={lang}
          task={task}
          user={user}
          msg={
            (dictionary.pages as I18nRecord)
              .transportValidationForm as I18nRecord
          }
        />
      );

    case TYPE_WFSHIP_SOVOS_DIGITAL_SIGNATURE:
      return (
        <SovosVerificationForm
          lang={lang}
          task={task}
          user={user}
          msg={
            (dictionary.pages as I18nRecord).sovosVerificationForm as I18nRecord
          }
        />
      );
    case TYPE_WFSHIP_MISSION_CONTROL_TRIP_INIT_TASK:
      return (
        <MissionControlTripInitForm
          lang={lang}
          task={task}
          user={user}
          msg={
            (dictionary.pages as I18nRecord)
              .transportValidationForm as I18nRecord
          }
        />
      );
    case TYPE_WFSHIP_OVERLORD_TRIP_INIT_TASK:
    case TYPE_WFSHIP_TRIP_OUTSIDE_INITIATED_TASK:
      return <ShippingDetailsTaskForm lang={lang} task={task} />;

    default:
      return notFound();
  }
}
