import { I18nRecord } from "@/features/i18n/i18n.service.types";

export type DriverContactInfoProps = {
  msg: I18nRecord;
  driver: Driver;
};

export type Driver = {
  name: string;
  email: string;
  phone: string;
  rut: string;
  status: string;
  varName: string;
};
