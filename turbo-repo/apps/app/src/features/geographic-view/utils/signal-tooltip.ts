import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import type { DescriptionProps } from "@/app/api/treatments/location/route.type";
import type {
  PulseListType,
  PulseType,
} from "../components/tooltips/pulse-tooltip";
import type { MapPosition, MapPositionProperties } from "../types/map";
import { isNewestFrame, offlineLabel, type SignalState } from "./signal-state";

/** "Motor apagado" for the vehicle's newest frame, at that frame's time. */
export type EngineLabel = { timestamp: string; label: string | null };

/** A selected frame keeps its metadata but reads signal and engine status on every render. */
export function pulseWithSignal(
  object: PulseType | PulseListType | undefined,
  assetId: string | undefined,
  signal: SignalState | null | undefined,
  dict: I18nRecord,
  description?: DescriptionProps,
  engine?: EngineLabel | null
): PulseType | PulseListType | undefined {
  if (!object) return object;
  if (!("properties" in object)) {
    return description ? { ...object, description } : object;
  }
  const sameAsset = object.properties.asset_id === assetId;
  const matches =
    sameAsset && isNewestFrame(object.properties.timestamp, signal);
  const signalLabel = matches ? offlineLabel(signal, dict) : null;
  const engineLabel =
    !signalLabel &&
    sameAsset &&
    engine?.timestamp === object.properties.timestamp
      ? engine.label
      : null;
  return {
    ...object,
    properties: {
      ...object.properties,
      signal_label: signalLabel,
      engine_label: engineLabel,
    },
  };
}

/** The live popup reads the selected asset's current signal and engine state, including their removal. */
export function pinWithSignal(
  object: MapPositionProperties | undefined,
  positions:
    | readonly Pick<
        MapPosition,
        "assetid" | "signal" | "timestamp" | "engine_off"
      >[]
    | null
    | undefined
): MapPositionProperties | undefined {
  if (!object) return object;
  const asset = object.properties.assetid ?? object.properties.asset_id;
  const current = positions?.find((position) => position.assetid === asset);
  const signal = current?.signal;
  return {
    ...object,
    properties: {
      ...object.properties,
      signal: isNewestFrame(current?.timestamp, signal) ? signal : null,
      engine_off: current?.engine_off === true,
    },
  };
}
