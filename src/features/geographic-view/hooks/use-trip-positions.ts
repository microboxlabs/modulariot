import { useState, useEffect } from "react";
import { MapPosition } from "../types/map";
import { MapService } from "../services/map-trip.service";

export function useTripPositions(tripId: string, assetId: string) {
  const [positions, setPositions] = useState<MapPosition[]>([]);
  const [error, _setError] = useState<Error | null>(null);
  const bufferSize = 500;

  useEffect(() => {
    let mounted = true;
    const positionBuffer: MapPosition[] = [];
    let reader: ReadableStreamDefaultReader<MapPosition>;

    async function startStreaming() {
      const stream = MapService.createPositionStream(tripId, assetId);
      reader = stream.getReader();

      try {
        while (mounted) {
          const { done, value } = await reader.read();

          if (done) {
            // Final flush of buffer
            if (positionBuffer.length > 0 && mounted) {
              setPositions((prev) => [...prev, ...positionBuffer.slice()]);
            }
            console.log("done");
            break;
          }

          positionBuffer.push(value);
          if (positionBuffer.length >= bufferSize) {
            if (mounted) {
              setPositions((prev) => [...prev, ...positionBuffer.slice()]);
              positionBuffer.length = 0;
            }
          }
        }
      } catch (err) {
        console.dir(err);
        if (mounted) {
          //setError(err instanceof Error ? err : new Error("Stream error"));
        }
      }
    }

    startStreaming();

    return () => {
      mounted = false;
      if (reader) {
        reader.cancel().catch(console.error);
      }
    };
  }, [tripId, assetId]);

  return { positions, error };
}
