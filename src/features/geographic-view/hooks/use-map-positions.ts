import { useState, useEffect } from "react";
import { MapService } from "../services/map.service";
import { MapPosition } from "../types/map";

export function useMapPositions(pollingInterval = 30000) { // 30 seconds default
  const [positions, setPositions] = useState<MapPosition[] | null>(null);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;
    let intervalId: NodeJS.Timeout;

    async function fetchPositions() {
      try {
        const data = await MapService.getPositions();
        if (mounted) {
          setPositions(data);
          setCount(data.length);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err : new Error("Failed to fetch map positions"));
          console.error("Map positions fetch error:", err);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    // Initial fetch
    fetchPositions();

    // Set up polling
    intervalId = setInterval(fetchPositions, pollingInterval);

    // Cleanup
    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
  }, [pollingInterval]);

  return { positions, count, loading, error };
} 