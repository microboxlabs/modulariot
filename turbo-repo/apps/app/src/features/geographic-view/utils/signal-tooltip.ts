import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import type {
  PulseListType,
  PulseType,
} from "../components/tooltips/pulse-tooltip";
import type { MapPosition, MapPositionProperties } from "../types/map";
import { isNewestFrame, offlineLabel, type SignalState } from "./signal-state";

/** A selected frame keeps its metadata but reads signal status on every render. */
export function pulseWithSignal(
  object: PulseType | PulseListType | undefined,
  assetId: string | undefined,
  signal: SignalState | null | undefined,
  dict: I18nRecord
): PulseType | PulseListType | undefined {
  if (!object || !("properties" in object)) return object;
  const matches =
    object.properties.asset_id === assetId &&
    isNewestFrame(object.properties.timestamp, signal);
  return {
    ...object,
    properties: {
      ...object.properties,
      signal_label: matches ? offlineLabel(signal, dict) : null,
    },
  };
}

/** The live popup reads the selected asset's current signal, including its removal. */
export function pinWithSignal(
  object: MapPositionProperties | undefined,
  positions:
    | readonly Pick<MapPosition, "assetid" | "signal">[]
    | null
    | undefined
): MapPositionProperties | undefined {
  if (!object) return object;
  const asset = object.properties.assetid ?? object.properties.asset_id;
  const current = positions?.find((position) => position.assetid === asset);
  return {
    ...object,
    properties: { ...object.properties, signal: current?.signal },
  };
}
