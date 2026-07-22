"use client";

import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";

export type NavParam = {
  label: string;
  param: { key: string; type: string };
  unique: boolean;
  options?: { value: string; label: string }[];
};

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
      { value: "INTERNAL", label: tr("internal", searchbarDict) },
      { value: "EXTERNAL", label: tr("external", searchbarDict) },
    ]),
    setParam("date_range", "date_range"),
  ];
}

/**
 * Calendar search params. Deliberately not a copy of `kanban_params`: the
 * calendar searches the service blob stored on a booking, which holds different
 * fields than an ECM task.
 *
 * - `originType` has no equivalent on the stored service.
 * - `date_range` is redundant — the calendar's own date axis is the date filter.
 * - driver/carrier are absent because the blob stores resource *UUIDs*
 *   (`assignedDriver`, `assignedCarrier`), not the RUTs the kanban searches.
 *   Only `licensePlate` survives, because `assignedTruckExternalId` really is
 *   the plate (`cami_matricula`).
 *
 * `assignment` is calendar-only: it finds services that are planned but not yet
 * crewed, which is the whole point of searching the calendar.
 */
function calendar_params(searchbarDict: I18nRecord): ParamType[] {
  return [
    setParam("service", "text"),
    setParam("customer", "text"),
    setParam("origin", "text"),
    setParam("destination", "text"),
    setParam("licensePlate", "text"),
    setParam("tipoViaje", "selector", [
      { value: "Sider", label: "Sider" },
      { value: "Doble Sider", label: "Doble Sider" },
      { value: "Rampla", label: "Rampla" },
    ]),
    setParam("assignment", "selector", [
      { value: "unassigned", label: tr("unassigned", searchbarDict) },
      { value: "partial", label: tr("partial", searchbarDict) },
      { value: "assigned", label: tr("assigned", searchbarDict) },
    ]),
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
  const calendar = calendar_params(searchbarDict);

  return {
    finished: getParamsFixed(kanban, dict),
    shipping: getParamsFixed(kanban, dict),
    delivery: getParamsFixed(kanban, dict),
    planning: getParamsFixed(kanban, dict),
    mytasks: getParamsFixed(kanban, dict),
    // Synthetic key — see `resolveSection` in section-filter-bar-controller.
    // Not a path segment, so `/calendar` (the landing page) stays bar-less.
    "calendar-planning": getParamsFixed(calendar, dict),
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
