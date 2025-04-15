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
  console.log("task", task);

  const task_id = task.id;
  const assetId = task.mintral_truckLicensePlate;


  // 2593023
  // 1450222
  // LWVC21

  const { positions, error } = useTripPositions(task_id as string, assetId as string);

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
    { latitude: 0, longitude: 0 },
  );

  return (
    <div className="bg-gray-100 dark:bg-gray-800 h-full w-full flex-1 overflow-hidden ">
      <MapVisualizationTrip
        tripId={task.id}
        positions={positions}
        error={error}
        averagePosition={averagePosition}
        filteredLocationData={null}
        dict={dictionary}
      />
    </div>
  );
}
