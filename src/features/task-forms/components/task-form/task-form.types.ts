import { Task } from "@/features/common/providers/alfresco-api/alfresco-api.types";
import { I18nRecord } from "@/features/i18n/i18n.service.types";

export type TaskFormProps = {
  task: Task;
  lang: string;
  msg?: I18nRecord;

};
