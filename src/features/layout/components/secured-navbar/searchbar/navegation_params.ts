"use client";

import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";

export type ParamType = string | { param: string; type: "date_range" | "text" };

const kanban_params: ParamType[] = [
  setParam("service", "text"),
  setParam("licensePlate", "text"),
  setParam("driverId", "text"),
  setParam("carrierId", "text"),
  setParam("origin", "text"),
  setParam("destination", "text"),
  setParam("customer", "text"),
  setParam("originType", "bool"),
  setParam("date_range", "date_range"),
];

function setParam(param: ParamType, type: "date_range" | "text" | "bool") {
  return { param, type } as ParamType;
}

export function getNavegationParams(dict: I18nRecord) {
  return {
    finished: getParamsFixed(kanban_params, dict),
    shipping: getParamsFixed(kanban_params, dict),
    delivery: getParamsFixed(kanban_params, dict),
    mytasks: getParamsFixed(kanban_params, dict),
  };
}

function getParamsFixed(params: ParamType[], dict: I18nRecord) {
  return params.map((param) => {
    const paramKey = typeof param === "string" ? param : param.param;
    const paramType = typeof param === "string" ? "text" : param.type;

    return {
      label: tr(paramKey, dict.searchbar as I18nRecord),
      param: {
        key: paramKey,
        type: paramType,
      },
    };
  });
}
