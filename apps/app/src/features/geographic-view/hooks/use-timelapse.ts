import useSWR from "swr";
import {
  timelapseMetadataSchema,
  type TimelapseMetadata,
} from "@/features/common/providers/alfresco-api/alfresco-api.provider";

export type TimelapseData = TimelapseMetadata & {
  proxyStreamUrl: string;
};

async function timelapseFetcher(url: string): Promise<TimelapseData | null> {
  const res = await fetch(url);
  if (!res.ok) return null;
  const json = await res.json();
  const metadata = timelapseMetadataSchema.parse(json);
  return {
    ...metadata,
    proxyStreamUrl: `/app/api/timelapse/stream?session_id=${encodeURIComponent(metadata.sessionId)}`,
  };
}

export function useTimelapse(
  licensePlate: string | null,
  timestamp: string | null
) {
  const key =
    licensePlate && timestamp
      ? `/app/api/timelapse?license_plate=${encodeURIComponent(licensePlate)}&timestamp=${encodeURIComponent(timestamp)}`
      : null;

  const { data, error, isLoading } = useSWR<TimelapseData | null>(
    key,
    timelapseFetcher,
    {
      revalidateOnFocus: false,
      shouldRetryOnError: false,
    }
  );

  return { timelapse: data ?? null, loading: isLoading, error: error ?? null };
}
