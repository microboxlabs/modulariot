import "server-only";

import {
  TYPE_WFSHIP_TRANSPORT_VALIDATION_TASK,
  TYPE_WFSHIP_MISSION_CONTROL_TRIP_INIT_TASK,
  TYPE_WFSHIP_OVERLORD_TRIP_INIT_TASK,
  TYPE_WFSHIP_SOVOS_DIGITAL_SIGNATURE,
  TYPE_WFSHIP_TRIP_OUTSIDE_INITIATED_TASK,
} from "../../services/form.service";
import TransportValidationForm from "../transport-validation-form/transport-validation-form";
import { TaskFormProps } from "./task-form.types";
import { notFound } from "next/navigation";
import { getDictionary } from "@/features/i18n/i18n.service";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { defaultLocale } from "@/features/i18n/tr.service";
import ShippingDetailsTaskForm from "../shipping-details-task-form/shipping-details-task-form";

export async function TaskForm({ task, lang }: TaskFormProps) {
  const [_dict, dictionary] = await getDictionary(lang ?? defaultLocale);
  switch (task.name) {
    case TYPE_WFSHIP_TRANSPORT_VALIDATION_TASK:
      return (
        <TransportValidationForm
          lang={lang}
          task={task}
          msg={
            (dictionary.pages as I18nRecord)
              .transportValidationForm as I18nRecord
          }
        />
      );

    case TYPE_WFSHIP_MISSION_CONTROL_TRIP_INIT_TASK:
    case TYPE_WFSHIP_OVERLORD_TRIP_INIT_TASK:
    case TYPE_WFSHIP_SOVOS_DIGITAL_SIGNATURE:
    case TYPE_WFSHIP_TRIP_OUTSIDE_INITIATED_TASK:
      return <ShippingDetailsTaskForm lang={lang} task={task} />;

    default:
      return notFound();
  }
}
