"use client";

import { I18nRecord } from "@/features/i18n/i18n.service.types";

export function getNavegationParams(dict: I18nRecord) {
  return {
    shipping: [
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
        ).serviceKind as string,
        param: "type",
      },
      {
        label: (
          ((dict.pages as I18nRecord).shipping as I18nRecord)
            .table as I18nRecord
        ).stage as string,
        param: "step",
      },
      {
        label: (
          ((dict.pages as I18nRecord).shipping as I18nRecord)
            .table as I18nRecord
        ).status as string,
        param: "status",
      },
    ],
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
        ).serviceKind as string,
        param: "type",
      },
      {
        label: (
          ((dict.pages as I18nRecord).shipping as I18nRecord)
            .table as I18nRecord
        ).stage as string,
        param: "step",
      },
      {
        label: (
          ((dict.pages as I18nRecord).shipping as I18nRecord)
            .table as I18nRecord
        ).status as string,
        param: "status",
      },
    ],
  };
}
