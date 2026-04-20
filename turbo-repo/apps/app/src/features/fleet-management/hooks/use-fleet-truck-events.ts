import useSWR from "swr";
import type { TruckEventsDetail } from "../types/truck-events.types";

export interface EventFilters {
  limit?: number;
  pDesde?: string;
  pHasta?: string;
  pTipoEvento?: string;
}

type FetcherResult = {
  eventsDetail: TruckEventsDetail | null;
  notFound: boolean;
};

const fetcher = async (url: string): Promise<FetcherResult> => {
  const response = await fetch(url);
  if (response.status === 404) {
    return { eventsDetail: null, notFound: true };
  }
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const eventsDetail = (await response.json()) as TruckEventsDetail;
  return { eventsDetail, notFound: false };
};

function buildEventsUrl(idOrPlate: string, filters?: EventFilters): string {
  const base = `/app/api/fleet/trucks/${encodeURIComponent(idOrPlate)}/events`;
  const params = new URLSearchParams();
  if (filters?.limit) params.set("limit", String(filters.limit));
  if (filters?.pDesde) params.set("p_desde", filters.pDesde);
  if (filters?.pHasta) params.set("p_hasta", filters.pHasta);
  if (filters?.pTipoEvento) params.set("p_tipo_evento", filters.pTipoEvento);
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

/**
 * Fetch operational events for a truck by numeric `mbl_id` or license
 * plate. Returns the 50 most recent events with severity >= Medio
 * (icu_code >= 2) by default, filtering out the Bajo/SEÑAL noise.
 *
 * Dedup window is 60s like the other fleet hooks since the event feed
 * doesn't change in real-time (symptoms finalize on the pipeline cadence).
 */
export function useFleetTruckEvents(
  idOrPlate: string | null | undefined,
  filters?: EventFilters
) {
  const url = idOrPlate ? buildEventsUrl(idOrPlate, filters) : null;

  const { data, error, isLoading, mutate } = useSWR<FetcherResult>(
    url,
    fetcher,
    { errorRetryCount: 2, dedupingInterval: 60000 }
  );

  return {
    eventsDetail: data?.eventsDetail ?? null,
    notFound: data?.notFound ?? false,
    error,
    isLoading,
    mutate,
  };
}
