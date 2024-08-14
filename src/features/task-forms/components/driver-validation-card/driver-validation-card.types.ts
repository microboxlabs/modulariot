import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { Driver } from "../driver-contact-info/driver-contact-info.type";

export type DriverValidationProps = {
  msg: I18nRecord;
  driver1: Driver;
  driver2?: Driver;
};
