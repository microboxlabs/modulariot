import { useState, useEffect } from "react";
import { HistoricSignal } from "../types/historic-signal.type";

export function historicPulsesUrl(
  assetId: string,
  p_from: string,
  p_to: string
): string | null {
  if (!assetId || !p_from || !p_to) return null;
  const params = new URLSearchParams({ assetId, p_from, p_to });
  return `/app/api/map/historic-pulses?${params.toString()}`;
}

export function useHistoricPulse(
  assetId: string,
  p_from: string,
  p_to: string
) {
  const [positions, setPositions] = useState<HistoricSignal[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const url = historicPulsesUrl(assetId, p_from, p_to);
    setPositions([]);
    setError(null);
    if (!url) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const positionBuffer: HistoricSignal[] = [];
    let opened = false;
    const eventSource = new EventSource(url);

    eventSource.onopen = () => {
      opened = true;
    };

    eventSource.onmessage = (event) => {
      try {
        positionBuffer.push(JSON.parse(event.data as string) as HistoricSignal);
        setPositions([...positionBuffer]);
      } catch {
        // Invalid JSON, skip
      }
    };

    // The server closes the stream after the last signal, which EventSource
    // reports as an error; only a stream that never opened is a failure.
    eventSource.onerror = () => {
      eventSource.close();
      setPositions([...positionBuffer]);
      if (!opened) setError(new Error("The signals could not be loaded"));
      setIsLoading(false);
    };

    return () => {
      eventSource.close();
    };
  }, [assetId, p_from, p_to]);

  return { positions, error, isLoading };
}
