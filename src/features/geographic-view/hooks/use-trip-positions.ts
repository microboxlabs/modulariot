import { useState, useEffect, useRef } from "react";
import { MapPosition } from "../types/map";

export function useTripPositions(tripId: string, assetId: string) {
  const [positions, setPositions] = useState<MapPosition[]>([]);
  const [error, _setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const positionBuffer: MapPosition[] = [];
    let size = 0;

    eventSourceRef.current = new EventSource(
      `/app/api/map/trip?tripId=${tripId}&assetId=${assetId}`,
    );

    const eventSource = eventSourceRef.current;

    eventSource.onopen = () => {
      setIsLoading(true);
    };

    eventSource.onmessage = (event) => {
      try {
        const position = JSON.parse(event.data as string) as MapPosition;
        positionBuffer[size++] = position;

        // Update positions immediately
        setPositions([...positionBuffer.slice()]);
      } catch (err) {
        // TODO: Check
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

    // Cleanup function
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        setIsLoading(false);
      }
    };
  }, [tripId, assetId]);

  return { positions, error, isLoading };
}
