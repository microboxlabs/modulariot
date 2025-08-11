"use client";
import useSWR from "swr";
import fetcher from "./fetcher";
import { KanbanBoardTaskResponse } from "@/features/shipping/types/common.types";
import {
  DownloadDocumentResponse,
  ServiceValidationResponse,
  SympthomTemplateResponse,
  TaskCountResponse,
  TaskResponse,
  UserGroupsResponse,
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
import { TreatmentsRequest } from "@/app/api/treatments/route.type";
import { TreatmentsLocationResponseItem } from "@/app/api/treatments/location/route.type";
import {
  SignIdCardRequest,
  ValidateIdCardRequest,
} from "./5cap-api/5cap-api.provider.types";
import { SendableFile } from "@/features/task-forms/components/task-bento-form/components/side-data/multimedia-manager.tsx/clasification-form";

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
  params?: string,
) {
  const columnQuery = columns.map((column) => `columns=${column}`).join("&");

  const from = page ? (page - 1) * (limit ?? 10) : 0;

  const paginationQuery = page && limit ? `from=${from}&size=${limit}` : "";
  const queryString = `${columnQuery}&${paginationQuery}&showFinished=${showFinished}&${params}`;

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
  return fetcher(`/app/api/entity?licencePlate=${entity}`);
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

export function useTreatmentsTemplates(
  serviceCode: string,
  conditionName: string,
  icuCode: string,
) {
  const { data, error, isLoading } = useSWR<
    SympthomTemplateResponse,
    FetcherError
  >(
    `/app/api/treatments/templates?serviceCode=${serviceCode}&conditionName=${conditionName}&icuCode=${icuCode}`,
    fetcher,
  );

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

export function useTreatmentsLocation(
  tripId: string,
  symptom_name: string,
  /*  first_date: string,
  last_date: string, */
  symptom_id: string,
) {
  const shouldFetch = tripId && symptom_name; //&& first_date && last_date
  //&first_date=${first_date}&last_date=${last_date}
  const { data, error, isLoading } = useSWR<
    TreatmentsLocationResponseItem,
    FetcherError
  >(
    shouldFetch
      ? `/app/api/treatments/location?trip_id=${tripId}&symptom_name=${symptom_name}&symptom_id=${symptom_id}`
      : null,
    fetcher,
  );

  return {
    data: shouldFetch ? data : null,
    error: shouldFetch ? error : null,
    isLoading: shouldFetch ? isLoading : false,
  };
}

export function useUserStatus() {
  const { data, error, isLoading } = useSWR<string, FetcherError>(
    "/app/api/user/status",
    fetcher,
  );

  return {
    data,
    error,
    isLoading,
  };
}

export function useUserGroups() {
  const { data, error, isLoading } = useSWR<UserGroupsResponse, FetcherError>(
    "/app/api/user/groups",
    fetcher,
  );

  return {
    data: data?.data ?? [],
    error,
    isLoading,
  };
}

export function useGetTasksById(taskId: string, finished: boolean) {
  const { data, error, isLoading } = useSWR<TaskResponse, FetcherError>(
    `/app/api/task/mytasks/details?taskId=${taskId}&finished=${finished}`,
    fetcher,
  );

  return {
    data,
    error,
    isLoading,
  };
}

//same as useUserStatus but without using useSWR
export function getUserStatus() {
  return fetcher("/app/api/user/status");
}

export function useGetUserStates() {
  const { data, error, isLoading } = useSWR<any, FetcherError>(
    `/app/api/user/states`,
    fetcher,
  );

  return {
    user_states: data,
    user_states_error: error,
    user_states_isLoading: isLoading,
  };
}

export function requestSovosFingerprintReuse(
  rut: string,
  tripId: string,
): Promise<any> {
  const url = `/app/api/sovos/fingerprint-reuse?rut=${rut}&tripId=${tripId}`;
  return fetcher(url);
}

export function validateIdCard(
  idCardRequest: ValidateIdCardRequest,
): Promise<any> {
  const url = `/app/api/task/validate-id-card`;
  return fetcher(url, {
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
    body: JSON.stringify(idCardRequest),
  });
}

export function signIdCard(idCardRequest: SignIdCardRequest): Promise<any> {
  const url = `/app/api/task/id-card-sign`;
  return fetcher(url, {
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
    body: JSON.stringify(idCardRequest),
  });
}

export function biometricVerify(
  driverId: string,
  deviceId: string,
  deviceLocation: string,
  fingerprintData?: object,
  driverSerieId?: string,
): Promise<any> {
  const url = "/app/api/biometric/verify";
  return fetcher(url, {
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
    body: JSON.stringify({
      driverId,
      deviceId,
      deviceLocation,
      fingerprintData: JSON.stringify(fingerprintData),
      driverSerieId,
    }),
  });
}

export function signDec5(taskId: string): Promise<any> {
  const url = `/app/api/task/sign-dec5`;
  return fetcher(url, {
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
    body: JSON.stringify({
      taskId,
    }),
  });
}

export function useGetNodeChildren(nodeId: string | undefined) {
  const { data, error, isLoading, mutate } = useSWR<any, FetcherError>(
    nodeId ? `/app/api/bento/multimedia?nodeId=${nodeId}` : null,
    fetcher,
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    },
  );

  return {
    data,
    error,
    isLoading,
    mutate,
  };
}

// Custom hook for optimistic file uploads
export function useOptimisticFileUpload(nodeId: string | undefined) {
  const { data, error, isLoading, mutate } = useGetNodeChildren(nodeId);

  const uploadFile = async (file: SendableFile) => {
    // Optimistic update - add the file to the current data
    const optimisticData = {
      ...data,
      data: {
        ...data?.data,
        list: {
          ...data?.data?.list,
          entries: [
            ...(data?.data?.list?.entries || []),
            {
              entry: {
                id: `temp-${Date.now()}`,
                name: file.prop_cm_name,
                content: {
                  mimeType: file.prop_mimetype,
                },
                properties: {
                  "mintral:contentType": file.prop_mintral_contentType,
                },
              },
            },
          ],
        },
      },
    };

    // Update the cache optimistically
    await mutate(optimisticData, false);

    try {
      // Perform the actual upload
      const result = await postBentoMultimedia(file);

      // Revalidate to get the real data from server
      await mutate();

      return result;
    } catch (error) {
      // If upload fails, revert the optimistic update
      await mutate();
      throw error;
    }
  };

  return {
    data,
    error,
    isLoading,
    uploadFile,
    mutate,
  };
}

export function useGetNodeContents(nodeIds: string[]) {
  const { data, error, isLoading } = useSWR<any, FetcherError>(
    nodeIds ? `/app/api/bento/document?nodeIds=${nodeIds.join(",")}` : null,
    fetcher,
  );

  return {
    data,
    error,
    isLoading,
  };
}

export function useGetNodeThumbnail(nodeId: string) {
  const { data, error, isLoading } = useSWR<Blob | null, FetcherError>(
    nodeId ? `/app/api/bento/thumbnails?nodeId=${nodeId}` : null,
    async (url: string) => {
      const response = await fetch(url);

      // Handle 404 gracefully - thumbnail doesn't exist
      if (response.status === 404) {
        // Return null instead of throwing error to prevent retries
        return null;
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch thumbnail: ${response.statusText}`);
      }

      // Return the blob directly
      return response.blob();
    },
    {
      // Prevent retries on 404 errors and limit retry attempts
      errorRetryCount: 3,
      errorRetryInterval: 1000,
      shouldRetryOnError: (error: FetcherError) => {
        // Don't retry on 404 errors
        return error.status !== 404;
      },
    },
  );

  return {
    data,
    error,
    isLoading,
  };
}

export function postBentoMultimedia(sendableFile: SendableFile) {
  const url = "/app/api/bento/upload";

  // Create FormData for file upload
  const formData = new FormData();
  formData.append("filedata", sendableFile.filedata);
  formData.append(
    "prop_mintral_contentType",
    sendableFile.prop_mintral_contentType,
  );
  formData.append("prop_cm_name", sendableFile.prop_cm_name);
  formData.append("prop_mimetype", sendableFile.prop_mimetype);
  formData.append("alf_destination", sendableFile.alf_destination);

  return fetcher(url, {
    method: "POST",
    body: formData,
  });
}

export function useGetValidation(
  serviceCode: string,
  scope?: string,
  scopeId?: string,
) {
  let baseUrl = `/app/api/task/validation?serviceCode=${serviceCode}`;
  if (scope && scopeId) {
    baseUrl += `&scope=${scope}&scopeId=${scopeId}`;
  }
  const { data, error, isLoading } = useSWR<
    ServiceValidationResponse,
    FetcherError
  >(baseUrl, fetcher);
  return {
    data,
    error,
    isLoading,
  };
}
