import { useState, useEffect } from "react";
import { MapPosition } from "../types/map";

export function useTripPositions(tripId: string, assetId: string) {
  const [positions, setPositions] = useState<MapPosition[]>([]);
  const [error, _setError] = useState<Error | null>(null);
  const positionBuffer: MapPosition[] = [];
  useEffect(() => {
    async function createPositionStream(tripId: string, assetId: string) {
      let eventSource: EventSource;
      let size = 0;

      return new ReadableStream({
        async start(_controller) {
          eventSource = new EventSource(
            `/app/api/map/trip?tripId=${tripId}&assetId=${assetId}`,
          );

          eventSource.onmessage = (event) => {
            try {
              const position = JSON.parse(event.data as string) as MapPosition;
              //controller.enqueue(position);
              positionBuffer[size++] = position;
              //console.log("positionBuffer:", positionBuffer.length);
              //console.log("size:", size);
              if (size % 2 === 0) {
                setPositions((_prev) => [...positionBuffer.slice()]);
              }
            } catch (err) {
              // TODO: Check if this is the correct way to handle the error Ignore some common errors
              //console.error("Failed to parse position data:", err, event.data);
            }
          };

          eventSource.onerror = (_error) => {
            // TODO: Check if this is the correct way to handle the error Ignore some common errors
            //console.error("EventSource error:", error);
            //console.log("eventSource.readyState:", eventSource.readyState);
            if (eventSource.readyState === 2) {
              //controller.error(error);
              eventSource.close();
              //console.log("size:", size);
              //console.log("positionBuffer:", positionBuffer.length);
              //setPositions((prev) => [...prev, ...positionBuffer.slice()]);
            }
            if (eventSource.readyState === 0) {
              //controller.error(error);
              eventSource.close();
            }
            //setPositions((_prev) => [...positionBuffer.slice()]);
            //positionBuffer.length = 0;
            //size = 0;
          };
        },
        cancel() {
          if (eventSource) {
            //console.log("Closing EventSource connection");
            eventSource.close();
          }
        },
      });
    }

    createPositionStream(tripId, assetId);

    return () => {
      //console.log("Unmounting useTripPositions");
    };
  }, [tripId, assetId]);

  return { positions, error };
}
