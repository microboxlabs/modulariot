import useSWR from "swr";
import {
  isNewestFrame,
  SignalStateSchema,
  type SignalState,
} from "../utils/signal-state";

/** How often an open case map asks again whether the signal is arriving. */
export const SIGNAL_REFRESH_MS = 60_000;

export function signalUrl(assetId: string | null | undefined): string | null {
  const id = assetId?.trim();
  return id ? `/app/api/map/signal?assetId=${encodeURIComponent(id)}` : null;
}

async function readSignal([url]: readonly [
  string,
  string | null | undefined,
]): Promise<SignalState | null> {
  const response = await fetch(url);
  if (!response.ok) return null;
  const parsed = SignalStateSchema.safeParse(await response.json());
  return parsed.success ? parsed.data : null;
}

/**
 * The vehicle's signal state by the lost-signal detector, refreshed every
 * minute; null while loading, without an asset, or when it cannot be read.
 */
export function useAssetSignal(
  assetId: string | null | undefined,
  newestTimestamp?: string | null
) {
  const url = signalUrl(assetId);
  const { data } = useSWR(
    url ? ([url, newestTimestamp] as const) : null,
    readSignal,
    {
      // Historical case tracks stop polling once a newer detector frame is known.
      // A changed track timestamp gets a new key and starts a fresh read.
      refreshInterval: (current) =>
        isNewestFrame(newestTimestamp, current) ? SIGNAL_REFRESH_MS : 0,
      revalidateOnFocus: true,
    }
  );
  return data ?? null;
}
