"use client";

import type { FleetKpi, VehicleStatus } from "../../types/fleet.types";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { KpiStat } from "@/features/common/components/kpi-stat";

interface KpiCardsRowProps {
  readonly kpis: FleetKpi[];
  readonly dict: I18nRecord;
  /** Currently selected state filter. undefined = no filter (total card). */
  readonly selectedState?: VehicleStatus;
  /**
   * Called when a KPI card is clicked. `state` is the card's associated
   * status, or undefined for the "total" card (which clears the filter).
   * Clicking the already-selected card should also clear the filter.
   */
  readonly onSelect?: (state: VehicleStatus | undefined) => void;
}

export default function KpiCardsRow({
  kpis,
  dict,
  selectedState,
  onSelect,
}: KpiCardsRowProps) {
  const isClickable = onSelect !== undefined;

  return (
    <div className="flex gap-3 h-fit">
      {kpis.map((kpi) => {
        const isSelected =
          kpi.state !== undefined && kpi.state === selectedState;
        // The "total" card is the cleared state — treat it as selected when
        // no state filter is active so the user sees where they are.
        const isTotalActive = kpi.state === undefined && selectedState === undefined;
        const highlight = isSelected || isTotalActive;

        const card = (
          <KpiStat
            icon={{
              icon: kpi.icon,
              className: `${kpi.color} ${kpi.darkColor}`,
            }}
            title={{ text: tr(`kpi.${kpi.labelKey}`, dict) }}
            value={{ text: kpi.value }}
            variant="horizontal"
            className={`min-w-45 flex-1 text-2xl transition-colors ${
              isClickable
                ? "hover:border-gray-400 dark:hover:border-gray-400"
                : ""
            } ${highlight ? "border-gray-400 dark:border-gray-400" : ""}`}
          />
        );

        if (!isClickable) {
          return <div key={kpi.id}>{card}</div>;
        }

        return (
          <button
            key={kpi.id}
            type="button"
            onClick={() => {
              // Clicking the currently-selected state clears the filter.
              if (isSelected) {
                onSelect(undefined);
              } else {
                onSelect(kpi.state);
              }
            }}
            className="flex-1 text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:focus-visible:ring-blue-400 rounded-lg"
            aria-pressed={highlight}
          >
            {card}
          </button>
        );
      })}
    </div>
  );
}
