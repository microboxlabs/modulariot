"use client";
import { useId, useState } from "react";
import { refreshIntervalSchema } from "@microboxlabs/miot-dashboard-contract/schema";
import type { RefreshInterval } from "@microboxlabs/miot-dashboard-contract/document";
import {
  generalSettingsSchema,
  type DashboardGeneralSettingsValue,
} from "./general-settings-value";
export type { DashboardGeneralSettingsValue } from "./general-settings-value";
export interface DashboardGeneralSettingsProps {
  /** Remount with a new key when the document or authentication changes. */
  readonly value: DashboardGeneralSettingsValue;
  readonly editable?: boolean;
  readonly onApply: (value: DashboardGeneralSettingsValue) => boolean;
  readonly labels: {
    name: string;
    refresh: string;
    order: string;
    apply: string;
    invalid: string;
    rejected: string;
    intervals: Record<RefreshInterval, string>;
  };
}
/** Local settings draft; the host owns authorization and document persistence. */
export function DashboardGeneralSettings({
  value,
  editable = false,
  onApply,
  labels,
}: DashboardGeneralSettingsProps) {
  const id = useId();
  const [name, setName] = useState(value.name);
  const [refreshInterval, setRefreshInterval] = useState(value.refreshInterval);
  const [order, setOrder] = useState(value.order?.toString() ?? "");
  const [error, setError] = useState<string>();
  function apply() {
    if (!editable) return;
    const parsed = generalSettingsSchema.safeParse({
      name,
      refreshInterval,
      order: order.trim() === "" ? undefined : Number(order),
    });
    if (!parsed.success) {
      setError(labels.invalid);
      return;
    }
    setError(onApply(parsed.data) ? undefined : labels.rejected);
  }
  return (
    <div className="miot-general-settings">
      <fieldset disabled={!editable}>
        <label htmlFor={`${id}-name`}>{labels.name}</label>
        <input
          id={`${id}-name`}
          value={name}
          maxLength={256}
          onChange={(event) => setName(event.target.value)}
        />
        <label htmlFor={`${id}-refresh`}>{labels.refresh}</label>
        <select
          id={`${id}-refresh`}
          value={refreshInterval}
          onChange={(event) => {
            const parsed = refreshIntervalSchema.safeParse(
              Number(event.target.value),
            );
            if (parsed.success) setRefreshInterval(parsed.data);
          }}
        >
          {([0, 10, 30, 60, 300] as const).map((interval) => (
            <option key={interval} value={interval}>
              {labels.intervals[interval]}
            </option>
          ))}
        </select>
        <label htmlFor={`${id}-order`}>{labels.order}</label>
        <input
          id={`${id}-order`}
          type="number"
          step="any"
          value={order}
          onChange={(event) => setOrder(event.target.value)}
        />
        <button type="button" onClick={apply}>
          {labels.apply}
        </button>
      </fieldset>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
