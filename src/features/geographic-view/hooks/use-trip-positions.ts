import { useState, useEffect } from "react";
import { MapPosition } from "../types/map";
import { MapService } from "../services/map-trip.service";

export function useTripPositions(
  tripId: string,
  assetId: string,
  interval = 2000,
) {
  const [positions, setPositions] = useState<MapPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    let mounted = true;
    let timeoutId: ReturnType<typeof setTimeout>;

    async function fetchNextChunk() {
      try {
        const response = await MapService.getPositions(tripId, assetId, offset);
        if (!response.length) {
          setHasMore(false);
          return;
        }

        if (mounted) {
          setPositions((prev) => [...prev, ...response]);
          setOffset((prev) => prev + response.length);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError(
            err instanceof Error ? err : new Error("Failed to fetch positions"),
          );
          setHasMore(false);
        }
      } finally {
        if (mounted) {
          setLoading(false);
          if (hasMore) {
            timeoutId = setTimeout(fetchNextChunk, interval);
          }
        }
      }
    }

    fetchNextChunk();

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
    };
  }, [tripId, interval, offset, hasMore]);

  return { positions, loading, error, hasMore };
}
