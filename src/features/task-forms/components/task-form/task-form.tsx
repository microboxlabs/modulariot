import "server-only";

import { TYPE_WFSHIP_TRANSPORT_VALIDATION_TASK } from "../../services/form.service";
import TransportValidationForm from "../transport-validation-form/transport-validation-form";
import { TaskFormProps } from "./task-form.types";
import { notFound } from "next/navigation";
import { getDictionary } from "@/features/i18n/i18n.service";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { defaultLocale } from "@/features/i18n/tr.service";

export async function TaskForm({ task, lang }: TaskFormProps) {
  const [dict, dictionary] = await getDictionary(lang?? defaultLocale);
  switch (task.name) {
    case TYPE_WFSHIP_TRANSPORT_VALIDATION_TASK:
      return <TransportValidationForm lang={lang} task={task} msg={(dictionary.pages as I18nRecord).transportValidationForm as I18nRecord} />;

    default:
      return notFound();
  }
}
