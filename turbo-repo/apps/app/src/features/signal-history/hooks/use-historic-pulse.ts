import { useState, useEffect } from "react";
import { HistoricSignal } from "../types/historic-signal.type";

const FLUSH_MS = 250;

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
    let failed = false;
    const eventSource = new EventSource(url);

    eventSource.onopen = () => {
      opened = true;
    };
    eventSource.addEventListener("failed", () => {
      failed = true;
    });

    // A burst of thousands of events renders once per flush, not per event.
    let flush: ReturnType<typeof setTimeout> | null = null;
    const show = () => {
      if (flush) clearTimeout(flush);
      flush = null;
      setPositions([...positionBuffer]);
    };

    eventSource.onmessage = (event) => {
      try {
        positionBuffer.push(JSON.parse(event.data as string) as HistoricSignal);
        flush ??= setTimeout(show, FLUSH_MS);
      } catch {
        // Invalid JSON, skip
      }
    };

    // The server closes the stream after the last signal, which EventSource
    // reports as an error; a stream that never opened or that sent "failed"
    // is a failure.
    eventSource.onerror = () => {
      eventSource.close();
      show();
      if (!opened || failed) {
        setError(new Error("The signals could not be loaded"));
      }
      setIsLoading(false);
    };

    return () => {
      if (flush) clearTimeout(flush);
      eventSource.close();
    };
  }, [assetId, p_from, p_to]);

  return { positions, error, isLoading };
}
