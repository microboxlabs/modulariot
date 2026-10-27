"use client";

import MapVisualizationTrip from "@/features/geographic-view/components/map-visualization-trip";
import { useTripPositions } from "@/features/geographic-view/hooks/use-trip-positions";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import type { BoardCard } from "../board/board-api";

/** The truck's positions from the trip's departure until it ends. */
export function TripMap({
  card,
  general,
}: Readonly<{ card: BoardCard; general: I18nRecord }>) {
  const { positions, error, isLoading } = useTripPositions(
    card.tripId,
    card.truck ?? ""
  );
  return (
    <div className="h-full w-full flex-1 overflow-hidden bg-gray-100 dark:bg-gray-800">
      <MapVisualizationTrip
        tripId={card.codes[0] ?? ""}
        positions={positions}
        error={error}
        isLoading={isLoading}
        filteredLocationData={null}
        dict={general}
        selectedTreatmentIndex={null}
        minimized={true}
        licensePlate={card.truck}
      />
    </div>
  );
}
