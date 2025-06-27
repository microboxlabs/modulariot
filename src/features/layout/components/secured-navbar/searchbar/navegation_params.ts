"use client";

import { I18nRecord } from "@/features/i18n/i18n.service.types";

export function getNavegationParams(dict: I18nRecord) {
  return {
    finished: [
      {
        label: (
          ((dict.pages as I18nRecord).shipping as I18nRecord)
            .table as I18nRecord
        ).service as string,
        param: "service",
      },
      {
        label: (
          ((dict.pages as I18nRecord).shipping as I18nRecord)
            .table as I18nRecord
        ).licensePlate as string,
        param: "licensePlate",
      },
      {
        label: (
          ((dict.pages as I18nRecord).shipping as I18nRecord)
            .table as I18nRecord
        ).driverId as string,
        param: "driverId",
      },
      {
        label: (
          ((dict.pages as I18nRecord).shipping as I18nRecord)
            .table as I18nRecord
        ).carrierId as string,
        param: "carrierId",
      },
      {
        label: (
          ((dict.pages as I18nRecord).shipping as I18nRecord)
            .table as I18nRecord
        ).origin as string,
        param: "origin",
      },
      {
        label: (
          ((dict.pages as I18nRecord).shipping as I18nRecord)
            .table as I18nRecord
        ).destination as string,
        param: "destination",
      },
      {
        label: (
          ((dict.pages as I18nRecord).shipping as I18nRecord)
            .table as I18nRecord
        ).customerCode as string,
        param: "customerCode",
      },
    ],
  };
}
