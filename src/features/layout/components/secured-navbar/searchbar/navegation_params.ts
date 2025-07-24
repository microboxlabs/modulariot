"use client";

import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";

const finished = [
  "service",
  "licensePlate",
  "driverId",
  // "carrierName",
  "carrierId",
  "origin",
  "destination",
  "customer",
];

export function getNavegationParams(dict: I18nRecord) {
  const finished_params = finished.map((param) => {
    return {
      label: tr(param, dict.searchbar as I18nRecord),
      param,
    };
  });

  return {
    finished: finished_params,
  };
}
