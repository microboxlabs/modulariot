import { useState, useEffect, useRef } from "react";
import { MapPosition } from "../types/map";
import {
  isEngineCaseId,
  tripIdOf,
} from "@/features/symptoms/model/treatment-link";

/**
 * The positions of the trip, or, for one of the evaluator's cases without a
 * trip, the vehicle's positions around the case. Empty when there is neither.
 */
export function positionsUrl(
  tripId: string | null | undefined,
  assetId: string | null | undefined,
  symptomId?: string | null
): string | null {
  const trip = tripIdOf(tripId);
  if (trip && assetId) {
    return `/app/api/map/trip?tripId=${encodeURIComponent(trip)}&assetId=${encodeURIComponent(assetId)}`;
  }
  if (!trip && isEngineCaseId(symptomId)) {
    return `/app/api/map/trip?symptomId=${encodeURIComponent(String(symptomId).trim())}`;
  }
  return null;
}

export function useTripPositions(
  tripId: string,
  assetId: string,
  symptomId?: string
) {
  const [positions, setPositions] = useState<MapPosition[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const url = positionsUrl(tripId, assetId, symptomId);
    if (!url) {
      setPositions([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    const positionBuffer: MapPosition[] = [];
    let size = 0;

    eventSourceRef.current = new EventSource(url);

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
      // The server closes the stream once it has sent every position, which
      // EventSource reports as an error; only a stream with nothing is one.
      if (size === 0) {
        console.error("EventSource connection failed", eventSource.readyState);
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
  }, [tripId, assetId, symptomId]);

  return { positions, error, isLoading };
}
