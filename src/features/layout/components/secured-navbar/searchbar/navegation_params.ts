"use client";

import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";

const kanban_params = [
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
  return {
    finished: getParamsFixed(kanban_params, dict),
    shipping: getParamsFixed(kanban_params, dict),
    delivery: getParamsFixed(kanban_params, dict),
    mytasks: getParamsFixed(kanban_params, dict),
  };
}

function getParamsFixed(params: string[], dict: I18nRecord) {
  return params.map((param) => {
    return {
      label: tr(param, dict.searchbar as I18nRecord),
      param,
    };
  });
}
