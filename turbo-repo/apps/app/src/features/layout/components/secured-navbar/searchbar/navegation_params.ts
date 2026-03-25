"use client";

import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";

export type ParamType =
  | string
  | {
      param: string;
      type: "date_range" | "text" | "bool" | "selector";
      options?: any[];
    };

const kanban_params: ParamType[] = [
  setParam("service", "text"),
  setParam("licensePlate", "text"),
  setParam("driverId", "text"),
  setParam("carrierId", "text"),
  setParam("origin", "text"),
  setParam("destination", "text"),
  setParam("customer", "text"),
  setParam("originType", "selector", [
    {
      value: "",
      label: "-",
    },
    {
      value: "INTERNAL",
      label: "Interno",
    },
    {
      value: "EXTERNAL",
      label: "Externo",
    },
  ]),
  setParam("date_range", "date_range"),
];

const where_is_my_load_params: ParamType[] = [
  setParam("expeditionCode", "text"),
  setParam("expeditionNumber", "text"),
];

const symptoms_params: ParamType[] = [
  setParam("asset_id", "text"),
  setParam("trip_id", "text"),
  setParam("driver_id", "text"),
  setParam("carrier_id", "text"),
  setParam("origin", "text"),
  setParam("destination", "text"),
  setParam("date", "date_range"),
  setParam(
    "symptom_name",
    "selector",
    localStorage.getItem("selector")
      ? JSON.parse(localStorage.getItem("selector")!)
      : []
  ), // here add a call on the cookies local data, search for a value called "selector" to load everything
];

function setParam(
  param: ParamType,
  type: "date_range" | "text" | "bool" | "selector",
  options?: any[]
) {
  return { param, type, options } as ParamType;
}

export function getNavegationParams(dict: I18nRecord, size: number) {
  return {
    finished: getParamsFixed(kanban_params, dict),
    shipping: getParamsFixed(kanban_params, dict),
    delivery: getParamsFixed(kanban_params, dict),
    planning: getParamsFixed(kanban_params, dict),
    mytasks: getParamsFixed(kanban_params, dict),
    "where-is-my-load": getParamsFixed(
      where_is_my_load_params,
      dict,
      size > 0,
      true
    ),
    symptoms: getParamsFixed(symptoms_params, dict),
  };
}

function getParamsFixed(
  params: ParamType[],
  dict: I18nRecord,
  shouldExist: boolean = true,
  unique: boolean = false
) {
  if (!shouldExist) {
    return null;
  }

  return params.map((param) => {
    const paramKey = typeof param === "string" ? param : param.param;
    const paramType = typeof param === "string" ? "text" : param.type;

    return {
      label: tr(paramKey, dict.searchbar as I18nRecord),
      param: {
        key: paramKey,
        type: paramType,
      },
      unique,
      options: typeof param === "string" ? undefined : param.options,
    };
  });
}
