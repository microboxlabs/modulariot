import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { TaskOutcome } from "../../services/form.service.types";

export type OtherOptionsProps = {
  dict: I18nRecord;
  handleSelection: (outcome: TaskOutcome, outcomeLabel: string) => void;
};
