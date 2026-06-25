"use client";

import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";

export type ParamType =
  | string
  | {
      param: string;
      type: "date_range" | "text" | "bool" | "selector";
      options?: any[];
    };

function kanban_params(searchbarDict: I18nRecord): ParamType[] {
  return [
    setParam("service", "text"),
    setParam("licensePlate", "text"),
    setParam("driverId", "text"),
    setParam("carrierId", "text"),
    setParam("origin", "text"),
    setParam("destination", "text"),
    setParam("customer", "text"),
    setParam("originType", "selector", [
      { value: "", label: tr("allOption", searchbarDict) },
      { value: "INTERNAL", label: tr("internal", searchbarDict) },
      { value: "EXTERNAL", label: tr("external", searchbarDict) },
    ]),
    setParam("date_range", "date_range"),
  ];
}

const where_is_my_load_params: ParamType[] = [
  setParam("expeditionCode", "text"),
  setParam("expeditionNumber", "text"),
];

function fleet_params(searchbarDict: I18nRecord): ParamType[] {
  return [
    setParam("licensePlate", "text"),
    setParam("client", "text"),
    setParam("state", "selector", [
      { value: "", label: tr("allOption", searchbarDict) },
      { value: "active", label: tr("stateActive", searchbarDict) },
      { value: "maintenance", label: tr("stateMaintenance", searchbarDict) },
      { value: "alert", label: tr("stateAlert", searchbarDict) },
      { value: "inactive", label: tr("stateInactive", searchbarDict) },
    ]),
  ];
}

const collaborators_management_params: ParamType[] = [
  setParam("name", "text"),
  setParam("rut", "text"),
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
  const searchbarDict = dict.searchbar as I18nRecord;
  const kanban = kanban_params(searchbarDict);
  const fleet = fleet_params(searchbarDict);

  return {
    home: null,
    finished: getParamsFixed(kanban, dict),
    shipping: getParamsFixed(kanban, dict),
    delivery: getParamsFixed(kanban, dict),
    planning: getParamsFixed(kanban, dict),
    mytasks: getParamsFixed(kanban, dict),
    "where-is-my-load": getParamsFixed(
      where_is_my_load_params,
      dict,
      size > 0,
      true
    ),
    symptoms: getParamsFixed(symptoms_params, dict),
    "geographic-view": getParamsFixed([setParam("licensePlate", "text")], dict),
    "fleet-management": getParamsFixed(fleet, dict),
    "collaborators-management": getParamsFixed(
      collaborators_management_params,
      dict,
      true
    ),
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
      label: trDynamic(paramKey, dict.searchbar as I18nRecord),
      param: {
        key: paramKey,
        type: paramType,
      },
      unique,
      options: typeof param === "string" ? undefined : param.options,
    };
  });
}
