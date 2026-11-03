import useSWR from "swr";
import type { SignalState } from "../utils/signal-state";

/** How often an open case map asks again whether the signal is arriving. */
export const SIGNAL_REFRESH_MS = 60_000;

export function signalUrl(assetId: string | null | undefined): string | null {
  const id = assetId?.trim();
  return id ? `/app/api/map/signal?assetId=${encodeURIComponent(id)}` : null;
}

async function readSignal(url: string): Promise<SignalState | null> {
  const response = await fetch(url);
  if (!response.ok) return null;
  return (await response.json()) as SignalState;
}

/**
 * The vehicle's signal state by the lost-signal detector, refreshed every
 * minute; null while loading, without an asset, or when it cannot be read.
 */
export function useAssetSignal(assetId: string | null | undefined) {
  const { data } = useSWR(signalUrl(assetId), readSignal, {
    refreshInterval: SIGNAL_REFRESH_MS,
    revalidateOnFocus: true,
  });
  return data ?? null;
}
