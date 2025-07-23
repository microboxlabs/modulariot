"use client";

import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";

export function getNavegationParams(dict: I18nRecord) {
  return {
    finished: [
      {
        label: tr("service", dict.searchbar as I18nRecord),
        param: "service",
      },
      {
        label: tr("licensePlate", dict.searchbar as I18nRecord),
        param: "licensePlate",
      },
      {
        label: tr("driverId", dict.searchbar as I18nRecord),
        param: "driverId",
      },
      {
        label: tr("carrierId", dict.searchbar as I18nRecord),
        param: "carrierId",
      },
      /*
      {
        label: tr("carrierName", (dict.searchbar as I18nRecord)),
        param: "carrierName",
      },
      */
      {
        label: tr("origin", dict.searchbar as I18nRecord),
        param: "origin",
      },
      {
        label: tr("destination", dict.searchbar as I18nRecord),
        param: "destination",
      },
      {
        label: tr("customer", dict.searchbar as I18nRecord),
        param: "customer",
      },
    ],
  };
}
