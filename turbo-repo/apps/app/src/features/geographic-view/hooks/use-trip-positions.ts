import { useState, useEffect, useRef } from "react";
import { MapPosition } from "../types/map";

export function useTripPositions(tripId: string, assetId: string) {
  const [positions, setPositions] = useState<MapPosition[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    // Skip API call if tripId or assetId are invalid
    if (!tripId || !assetId) {
      setPositions([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    const positionBuffer: MapPosition[] = [];
    let size = 0;

    eventSourceRef.current = new EventSource(
      `/app/api/map/trip?tripId=${tripId}&assetId=${assetId}`
    );

    const eventSource = eventSourceRef.current;

    eventSource.onopen = () => {
      setIsLoading(true);
    };

    eventSource.onmessage = (event) => {
      try {
        const position = JSON.parse(event.data as string) as MapPosition;
        positionBuffer[size++] = position;
      } catch {
        // Invalid JSON, skip
      }
    };

    eventSource.onerror = () => {
      setPositions([...positionBuffer]);
      // El fin normal de un stream SSE también dispara onerror: solo es
      // falla real si el servidor cerró sin entregar ninguna posición.
      if (size === 0) {
        console.error("EventSource connection failed", eventSource.readyState, size);
        setError(new Error("No se pudo cargar el recorrido del viaje"));
      }
      eventSource.close();
      setIsLoading(false);
    };
    // Cleanup function
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        setIsLoading(false);
      }
      setPositions([...positionBuffer]);
    };
  }, [tripId, assetId]);

  return { positions, error, isLoading };
}
