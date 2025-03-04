import { useState, useEffect } from "react";
import { MapPosition } from "../types/map";
import { MapService } from "../services/map-trip.service";

export function useTripPositions(tripId: string, assetId: string) {
  const [positions, setPositions] = useState<MapPosition[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const bufferSize = 10;

  useEffect(() => {
    let mounted = true;
    const positionBuffer: MapPosition[] = [];

    async function startStreaming() {
      try {
        const stream = MapService.createPositionStream(tripId, assetId);
        const reader = stream.getReader();

        while (mounted) {
          const { done, value } = await reader.read();
          if (done) break;

          positionBuffer.push(value);

          // Update positions when buffer reaches size or on last item
          if (positionBuffer.length >= bufferSize) {
            if (mounted) {
              setPositions((prev) => [...prev, ...positionBuffer]);
              positionBuffer.length = 0; // Clear buffer
            }
          }
        }
      } catch (err) {
        console.error("Stream error:", err);
        setError(err instanceof Error ? err : new Error("Stream error"));
      }
    }

    startStreaming();
    return () => {
      mounted = false;
    };
  }, [tripId, assetId]);

  return { positions, error };
}
