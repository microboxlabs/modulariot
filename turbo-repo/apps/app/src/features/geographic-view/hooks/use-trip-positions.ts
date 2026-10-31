import { useState, useEffect, useRef } from "react";
import { MapPosition } from "../types/map";
import {
  isEngineCaseId,
  tripIdOf,
} from "@/features/symptoms/model/treatment-link";

/**
 * For one of the evaluator's cases, the vehicle's positions around the case:
 * its trip is a trips-module trip, which the GPS database does not know.
 * Otherwise the positions of the trip; empty without one.
 */
export function positionsUrl(
  tripId: string | null | undefined,
  assetId: string | null | undefined,
  symptomId?: string | null
): string | null {
  if (isEngineCaseId(symptomId)) {
    return `/app/api/map/trip?symptomId=${encodeURIComponent(String(symptomId).trim())}`;
  }
  const trip = tripIdOf(tripId);
  if (trip && assetId) {
    return `/app/api/map/trip?tripId=${encodeURIComponent(trip)}&assetId=${encodeURIComponent(assetId)}`;
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
