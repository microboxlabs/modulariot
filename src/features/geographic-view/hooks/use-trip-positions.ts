import { useState, useEffect } from "react";
import { MapPosition } from "../types/map";

export function useTripPositions(tripId: string, assetId: string) {
  const [positions, setPositions] = useState<MapPosition[]>([]);
  const [error, _setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);
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

          console.log("eventSource:", eventSource);

          eventSource.onopen = () => {
            setIsLoading(true);
          };

          eventSource.onmessage = (event) => {
            try {
              const position = JSON.parse(event.data as string) as MapPosition;
              positionBuffer[size++] = position;
              if (size % 2 === 0) {
                setPositions((_prev) => [...positionBuffer.slice()]);
              }
            } catch (err) {
              // TODO: Check if this is the correct way to handle the error Ignore some common errors
            }
          };

          eventSource.onerror = (_error) => {
            if (eventSource.readyState === 2) {
              eventSource.close();
              setIsLoading(false);
            }
            if (eventSource.readyState === 0) {
              eventSource.close();
              setIsLoading(false);
            }
          };
        },
        cancel() {
          if (eventSource) {
            eventSource.close();
            setIsLoading(false);
          }
        },
      });
    }

    createPositionStream(tripId, assetId);

    return () => {
      // setIsLoading(false);
    };
  }, [tripId, assetId]);

  return { positions, error, isLoading };
}
