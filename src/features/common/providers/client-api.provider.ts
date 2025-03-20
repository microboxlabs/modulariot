"use client";
import useSWR from "swr";
import fetcher from "./fetcher";
import { KanbanBoardTaskResponse } from "@/features/shipping/types/common.types";
import {
  DownloadDocumentResponse,
  ServiceValidationResponse,
  TaskCountResponse,
  VerifyDocumentResponse,
} from "./alfresco-api/alfresco-api.types";
import { GetEntityInfoResponse } from "./microboxlabs-api/microboxlabs-api.types";
import { FetcherError } from "./fetcher.types";
import {
  SymptomDashboard,
  SymptomTableResponse,
} from "../../symptoms/types/symptoms";
import { SymptomsICUItemResponse } from "@/app/api/symptoms/icu/route.type";
import {
  MapPosition,
  MapPositionResume,
} from "@/features/geographic-view/types/map";
import { MapService } from "@/features/geographic-view/services/map.service";
import { TreatmentsTemplatesResponse } from "@/app/api/treatments/templates/route.type";
import { TreatmentsRequest } from "@/app/api/treatments/route.type";

// export function useI8n(lang: string) {
//   const { data, error, isLoading } = useSWR(`/api/i18n/${lang}`, fetcher);
//   return {
//     dict: data,
//     error,
//     isLoading,
//   };
// }

export function useMyTasks(
  columns: string[],
  showFinished: boolean,
  page?: number,
  limit?: number,
) {
  const columnQuery = columns.map((column) => `columns=${column}`).join("&");

  const from = page ? (page - 1) * (limit ?? 10) : 0;

  const paginationQuery = page && limit ? `from=${from}&size=${limit}` : "";
  const queryString = `${columnQuery}&${paginationQuery}&showFinished=${showFinished}`;

  const { data, error, isLoading } = useSWR<
    KanbanBoardTaskResponse,
    FetcherError
  >(`/app/api/task/mytasks?${queryString}`, fetcher);

  return {
    data,
    error,
    isLoading,
  };
}

export function useMyTasksCount() {
  const { data, error, isLoading } = useSWR<TaskCountResponse, FetcherError>(
    `/app/api/task/mytasks/count`,
    fetcher,
  );
  return {
    data,
    error,
    isLoading,
  };
}

// This gets replaced by a fetched action, since useSWR generates performance issues when loading the elements in the serverside component who reads it
/**
 * @deprecated Use getEntityInfo instead due to performance issues with SWR implementation
 * @see GitHub Issue [#43](https://github.com/microboxlabs/coordinador-webclient/issues/43) for more details
 *
 * Example usage of new implementation:
 * ```typescript
 * const entityInfo = await getEntityInfo(entity);
 * ```
 */
export function useGetEntityInfo(entity: string) {
  const { data, error, isLoading } = useSWR<
    GetEntityInfoResponse,
    FetcherError
  >(`/app/api/microboxlabs/entity?entity=${entity}`, fetcher);
  return {
    data,
    error,
    isLoading,
  };
}

/**
 * Fetches entity information without SWR for better performance.
 * Implements basic caching to prevent unnecessary API calls.
 *
 * @param entity - The entity identifier to fetch information for
 * @returns Promise<GetEntityInfoResponse>
 */
export function getEntityInfo(entity: string) {
  return fetcher(`/app/api/microboxlabs/entity?entity=${entity}`);
}

export function useGetServiceValidation(serviceCode: string) {
  const { data, error, isLoading } = useSWR<
    ServiceValidationResponse,
    FetcherError
  >(`/app/api/service/validation?serviceCode=${serviceCode}`, fetcher);
  return {
    data,
    error,
    isLoading,
  };
}

export function useSearchTasks(searchTerm: string | null) {
  const { data, error, isLoading } = useSWR<
    KanbanBoardTaskResponse,
    FetcherError
  >(
    searchTerm
      ? `/app/api/task/search?filter=mintral_key:v${searchTerm}`
      : null,
    fetcher,
  );
  return {
    data,
    error,
    isLoading,
  };
}

export function useDownloadDocument(documentId: string | undefined) {
  const { data, error, isLoading } = useSWR<
    DownloadDocumentResponse,
    FetcherError
  >(
    documentId ? `/app/api/document/download?documentId=${documentId}` : null,
    fetcher,
  );
  return {
    content: data?.content,
    error,
    isLoading,
  };
}

export function useVerifyDocument(documentId: string) {
  const { data, error } = useSWR<VerifyDocumentResponse, FetcherError>(
    `/app/api/document/verify?documentId=${documentId}`,
    fetcher,
  );
  return {
    exists: data?.exists,
    error,
  };
}

export function useSymptoms() {
  const { data, error, isLoading } = useSWR<SymptomDashboard, FetcherError>(
    "/app/api/symptoms/dashboard",
    fetcher,
    {
      refreshInterval: 30000,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    },
  );

  const count = data
    ? Object.values(data).reduce<number>(
        (sum, value) => (typeof value === "number" ? sum + value : sum),
        0,
      )
    : 0;

  return {
    symptoms: data,
    count,
    loading: isLoading,
    error,
  };
}

export function useSymptomsTable({
  page = 1,
  pageSize = 10,
  search = "",
  condition = "",
}: {
  page?: number;
  pageSize?: number;
  search?: string;
  condition?: string;
}) {
  const { data, error, isLoading } = useSWR<SymptomTableResponse, FetcherError>(
    `/app/api/symptoms/table?page=${page}&limit=${pageSize}${search ? "&search=" + search : ""}${condition ? "&condition=" + condition : ""}`,
    fetcher,
    {
      refreshInterval: 30000,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    },
  );

  return {
    tableData: data,
    loading: isLoading,
    error,
  };
}

export function useSymptomsIcu(condition?: string) {
  const url = condition
    ? `/app/api/symptoms/icu?p_icu_code=${condition}`
    : "/app/api/symptoms/icu";

  const { data, error, isLoading, isValidating, mutate } = useSWR<
    SymptomsICUItemResponse[],
    Error
  >(
    url,
    async (fetchUrl) => {
      const response = await fetch(fetchUrl);
      if (!response.ok) throw new Error("Failed to fetch ICU data");
      return response.json();
    },
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    },
  );

  return {
    icuData: data || [],
    isLoading,
    isError: !!error,
    error,
    isValidating,
    mutate,
  };
}

export function useMapPositions() {
  const { data, error, isLoading, mutate } = useSWR<MapPosition[], Error>(
    "/app/api/map",
    async (url: string) => {
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch map positions");
      const data = (await response.json()) as MapPosition[];
      return data?.map((position: MapPosition) => {
        const [longitude, latitude] = MapService.parseWKBPoint(
          position.location,
        );
        return {
          ...position,
          longitude,
          latitude,
        };
      });
    },
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    },
  );

  return {
    positions: data || [],
    isLoading,
    isError: !!error,
    error,
    count: data?.length || 0,
    mutate,
  };
}

export function useMapPositionsResume() {
  const { data, error, isLoading, mutate } = useSWR<MapPositionResume, Error>(
    "/app/api/map/resume",
    async (url: string) => {
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch map positions");
      const data = (await response.json()) as MapPositionResume;
      return data;
    },
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    },
  );

  return {
    data: data || [],
    isLoading,
    isError: !!error,
    error,
    mutate,
  };
}

export function useGeofences(tripId: string) {
  const { data, error, isLoading } = useSWR<any, FetcherError>(
    `/app/api/map/geofences?tripId=${tripId}`,
    fetcher,
  );

  return {
    geofence_data: data,
    geofence_error: error,
    geofence_isLoading: isLoading,
  };
}

export function useTreatmentsTemplates(id: string, name: string) {
  const { data, error, isLoading } = useSWR<
    TreatmentsTemplatesResponse,
    FetcherError
  >(`/app/api/treatments/templates?id=${id}&name=${name}`, fetcher);

  return {
    treatments_templates: data,
    treatments_templates_error: error,
    treatments_templates_isLoading: isLoading,
  };
}

export function requestTreatment(
  treatmentRequest: TreatmentsRequest,
): Promise<TreatmentsRequest> {
  const url = `/app/api/treatments`;
  return fetcher(url, {
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
    body: JSON.stringify(treatmentRequest),
  });
}

interface Release {
  version: string;
  // Add other release properties as needed
}

export function useReleases() {
  const { data, error, isLoading } = useSWR<Release[], FetcherError>(
    `/app/api/releases`,
    fetcher,
  );

  return {
    releases: data || [],
    error,
    isLoading,
  };
}
