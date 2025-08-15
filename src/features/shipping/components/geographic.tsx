"use client";

import MapVisualizationTrip from "@/features/geographic-view/components/map-visualization-trip";
import { useTripPositions } from "@/features/geographic-view/hooks/use-trip-positions";
import { TaskResponse } from "@/features/common/providers/alfresco-api/alfresco-api.types";

export default function Geographic({
  task,
  dictionary,
}: {
  task: TaskResponse;
  dictionary: Record<string, string>;
}) {
  const trip_id = task.mintral_serviceCode;
  const assetId = task.mintral_truckLicensePlate;

  const { positions, error, isLoading } = useTripPositions(
    trip_id as string,
    assetId as string
  );

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  const averagePosition = positions?.reduce(
    (acc, curr) => {
      return {
        latitude: acc.latitude + curr.latitude / positions.length,
        longitude: acc.longitude + curr.longitude / positions.length,
      };
    },
    { latitude: 0, longitude: 0 }
  );

  return (
    <div className="bg-gray-100 dark:bg-gray-800 h-full w-full flex-1 overflow-hidden ">
      <MapVisualizationTrip
        tripId={task.mintral_serviceCode as string}
        positions={positions}
        error={error}
        isLoading={isLoading}
        averagePosition={averagePosition}
        filteredLocationData={null}
        dict={dictionary}
        selectedTreatmentIndex={null}
        minimized={true}
      />
    </div>
  );
}
