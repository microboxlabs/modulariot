import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";

const OFF_VALUES = new Set(["0", "false", "off"]);

/**
 * Whether an engine status reads as off: `false`, `0`, "0", "false" or
 * "off". Anything else, including a missing value, is not off.
 */
export function isEngineOffValue(value: unknown): boolean {
  if (value === false || value === 0) return true;
  if (typeof value === "string") {
    return OFF_VALUES.has(value.trim().toLowerCase());
  }
  return false;
}

type EngineFrame = {
  engine_status?: unknown;
  sensors?: { engine_status?: unknown } | null;
};

/** The frame's engine status, from `sensors.engine_status` or `engine_status`. */
export function frameEngineStatus(
  frame: EngineFrame | null | undefined
): unknown {
  const fromSensors = frame?.sensors?.engine_status;
  if (fromSensors !== undefined && fromSensors !== null) return fromSensors;
  return frame?.engine_status ?? null;
}

/** Whether the frame reports the engine off. */
export function isEngineOffFrame(
  frame: EngineFrame | null | undefined
): boolean {
  return isEngineOffValue(frameEngineStatus(frame));
}

/** "Motor apagado" / "Engine off" when the engine is off and the signal is not lost. */
export function engineOffLabel(
  engineOff: boolean,
  offline: boolean,
  dict: I18nRecord
): string | null {
  if (offline || !engineOff) return null;
  return tr("geographic_view.engine_off", dict);
}

/**
 * Whether the newest frame reports the engine off. The frame's own status
 * comes first; without one, the engine status the case last reported.
 */
export function newestEngineOff(
  newest: EngineFrame | null | undefined,
  reported?: boolean | null
): boolean {
  if (!newest) return false;
  return isEngineOffValue(frameEngineStatus(newest) ?? reported);
}
