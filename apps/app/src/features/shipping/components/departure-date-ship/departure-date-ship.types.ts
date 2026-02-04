import { I18nRecord } from "@/features/i18n/i18n.service.types";

export type DepartureDateShipProps = {
  dict: I18nRecord;
  date: string;
  table_name: string;
  compact?: boolean;
};
