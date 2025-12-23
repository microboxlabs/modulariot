import { useState, useEffect, useRef } from "react";
import { HistoricSignal } from "../types/historic-signal.type";

export function useHistoricPulse(
  assetId: string,
  p_from: string,
  p_to: string
) {
  const [positions, setPositions] = useState<HistoricSignal[]>([]);
  const [error, _setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const positionBuffer: HistoricSignal[] = [];
    let size = 0;

    eventSourceRef.current = new EventSource(
      `/app/api/map/historic-pulses?assetId=${assetId}&p_from=${p_from}&p_to=${p_to}`
    );

    const eventSource = eventSourceRef.current;

    eventSource.onopen = () => {
      setIsLoading(true);
    };

    eventSource.onmessage = (event) => {
      try {
        const position = JSON.parse(event.data as string) as HistoricSignal;
        positionBuffer[size++] = position;
        setPositions([...positionBuffer.slice(0, size)]);
        // Update positions immediately
        /* setTimeout(() => {
          setPositions([...positionBuffer.slice()]);
        }, 500); */
      } catch (err) {
        // TODO: Check
        console.error(err);
      }
    };

    const closeConnection = () => {
      setPositions([...positionBuffer.slice()]);
      eventSource.close();
      setIsLoading(false);
    };

    eventSource.onerror = (_error) => {
      if (eventSource.readyState === 2 || eventSource.readyState === 0) {
        closeConnection();
      }
    };

    // Cleanup function
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        setIsLoading(false);
      }
      setPositions([...positionBuffer.slice()]);
    };
  }, [assetId, p_from, p_to]);

  return { positions, error, isLoading };
}
