import { useState, useEffect } from "react";
import type { TimelapseMetadata } from "@/features/common/providers/alfresco-api/alfresco-api.provider";

export type TimelapseData = TimelapseMetadata & {
  proxyStreamUrl: string;
};

export function useTimelapse(
  licensePlate: string | null,
  timestamp: string | null
) {
  const [timelapse, setTimelapse] = useState<TimelapseData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!licensePlate || !timestamp) {
      setTimelapse(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetch(
      `/app/api/timelapse?license_plate=${encodeURIComponent(licensePlate)}&timestamp=${encodeURIComponent(timestamp)}`
    )
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          setTimelapse(null);
          return;
        }
        const metadata: TimelapseMetadata = await res.json();
        setTimelapse({
          ...metadata,
          proxyStreamUrl: `/app/api/timelapse/stream?session_id=${encodeURIComponent(metadata.sessionId)}`,
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err);
        setTimelapse(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [licensePlate, timestamp]);

  return { timelapse, loading, error };
}
