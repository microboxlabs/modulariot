"use client";
import { z } from "zod";
import useSWR, { SWRConfiguration } from "swr";
import { useEffect, useMemo, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";
import fetcher, { createFetcherError } from "./fetcher";
import { safeJsonParse } from "./safe-json";
import { KanbanBoardTaskResponse } from "@/features/shipping/types/common.types";
import {
  DownloadDocumentResponse,
  ServiceValidationResponse,
  SympthomTemplateResponse,
  TaskCountResponse,
  TaskResponse,
  UserGroupsResponse,
  VerifyDocumentResponse,
  StatisticsTasksResponse,
} from "./alfresco-api/alfresco-api.types";
import { GetEntityInfoResponse } from "./microboxlabs-api/microboxlabs-api.types";
import { FetcherError, FetcherErrorCode } from "./fetcher.types";
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
import type {
  ForumDiscussionResponse,
  UserSiteResponse,
} from "./alfresco-api/alfresco-api.types";
import { LoadSearchResponse } from "@/types/load.types";
import type {
  TimeSlotResponse,
  TimeSlotListResponse,
  CreateTimeSlotRequest,
  UpdateTimeSlotRequest,
} from "@/features/calendar/types/time-slot.types";
import type {
  CalendarResponse,
  CalendarGroupResponse,
  CalendarRequest,
  CalendarGroupRequest,
  TimeWindowResponse,
  TimeWindowRequest,
  BookingRequest,
  BookingUpdateRequest,
  BookingResponse,
  BookingListResponse,
  MoveBookingRequest,
  SlotResponse,
  SlotListResponse,
} from "@microboxlabs/miot-calendar-client";
import type { ServiceType } from "./alfresco-api/service-types.types";
import type { ObservationTypeItem } from "./alfresco-api/observation-types.types";

export function useMyTasks(
  columns: string[],
  showFinished: boolean,
  page?: number,
  limit?: number,
  params?: string
) {
  const columnQuery = columns.map((column) => `columns=${column}`).join("&");

  const from = page ? (page - 1) * (limit ?? 10) : 0;

  const paginationQuery = page && limit ? `from=${from}&size=${limit}` : "";
  const queryString = `${columnQuery}&${paginationQuery}&showFinished=${showFinished}&${params}`;

  const { data, error, isLoading, mutate } = useSWR<
    KanbanBoardTaskResponse,
    FetcherError
  >(`/app/api/task/mytasks?${queryString}`, fetcher);

  return {
    data,
    error,
    isLoading,
    refresh: mutate,
  };
}

export function useMyTasksCount() {
  const { data, error, isLoading } = useSWR<TaskCountResponse, FetcherError>(
    `/app/api/task/mytasks/count`,
    fetcher
  );

  return {
    data,
    error,
    isLoading,
  };
}

/**
 * Hook to fetch the user's site and theme-specific logos
 * Caches the result and doesn't refetch on focus to minimize API calls
 *
 * Logo priority:
 * - Light theme: logo-black.svg → logo-black.png → logo.svg → logo.png
 * - Dark theme: logo-white.svg → logo-white.png → logo.svg → logo.png
 */
export function useUserSite() {
  const { data, error, isLoading } = useSWR<UserSiteResponse, FetcherError>(
    `/app/api/user/site`,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 60000, // 1 minute
    }
  );

  return {
    data,
    error,
    isLoading,
    siteName: data?.site?.shortName ?? null,
    siteTitle: data?.site?.title ?? null,
    /** Logo for light theme (logo-black or fallback) */
    logoUrlLight: data?.logoUrlLight ?? null,
    /** Logo for dark theme (logo-white or fallback) */
    logoUrlDark: data?.logoUrlDark ?? null,
  };
}

export function useHistoricInstancesCount() {
  const { data, error, isLoading } = useSWR<
    StatisticsTasksResponse,
    FetcherError
  >(`/app/api/task/statistics?mode=historic_instances`, fetcher);

  return {
    data,
    error,
    isLoading,
  };
}

export async function getMyTasks(
  columns: string[],
  showFinished: boolean,
  page?: number,
  limit?: number,
  params?: string
) {
  const columnQuery = columns.map((column) => `columns=${column}`).join("&");

  const from = page ? (page - 1) * (limit ?? 10) : 0;

  const paginationQuery = page && limit ? `from=${from}&size=${limit}` : "";
  const queryString = `${columnQuery}&${paginationQuery}&showFinished=${showFinished}&${params}`;

  const data = await fetcher<KanbanBoardTaskResponse>(
    `/app/api/task/mytasks?${queryString}`
  );

  return data;
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
    fetcher
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
    documentId ? `/api/document/download?documentId=${documentId}` : null,
    fetcher
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
    fetcher
  );
  return {
    exists: data?.exists,
    error,
  };
}

export function useSymptoms(date_range?: { from: string; to: string }) {
  const { data, error, isLoading } = useSWR<SymptomDashboard, FetcherError>(
    "/app/api/symptoms/dashboard" +
      (date_range?.from && date_range?.to
        ? `?from=${date_range.from}&to=${date_range.to}`
        : ""),
    fetcher,
    {
      refreshInterval: 30000,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    }
  );

  const count = data
    ? Object.values(data).reduce<number>(
        (sum, value) => (typeof value === "number" ? sum + value : sum),
        0
      )
    : 0;

  return {
    symptoms: data,
    count,
    loading: isLoading,
    error,
  };
}

/*
  setParam("asset_id", "text"),
  setParam("trip_id", "text"),
  setParam("driver_id", "text"),
  setParam("carrier_id", "text"),
  setParam("origin", "text"),
  setParam("destination", "text"),
*/

function param_set(
  value_to_pass: string | null,
  parameter_name: string
): string {
  return `${value_to_pass ? "&" + parameter_name + "=" + value_to_pass : ""}`;
}

export function useSymptomsTable({
  page = 1,
  pageSize = 10,
  icu_code = "",
  trip_id = "",
  asset_id = "",
  driver_id = "",
  carrier_id = "",
  origin = "",
  destination = "",
  symptom_name = "",
  date_range,
}: {
  page?: number;
  pageSize?: number;
  icu_code?: string;
  trip_id?: string;
  asset_id?: string;
  driver_id?: string;
  carrier_id?: string;
  origin?: string;
  destination?: string;
  symptom_name?: string;
  date_range?: {
    from: string;
    to: string;
  };
}) {
  const { data, error, isLoading, isValidating, mutate } = useSWR<
    SymptomTableResponse,
    FetcherError
  >(
    `/app/api/symptoms/table?page=${page}
    &limit=${pageSize}
    ${param_set(trip_id, "trip_id")}
    ${param_set(icu_code, "icu_code")}
    ${param_set(asset_id, "asset_id")}
    ${param_set(driver_id, "driver_id")}
    ${param_set(carrier_id, "carrier_id")}
    ${param_set(origin, "origin")}
    ${param_set(destination, "destination")}
    ${param_set(symptom_name, "symptom_name")}
    ${param_set(date_range?.from ?? null, "from")}
    ${param_set(date_range?.to ?? null, "to")}`,
    fetcher,
    {
      refreshInterval: 30000,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    }
  );

  return {
    tableData: data,
    loading: isLoading,
    isValidating,
    error,
    refetch: mutate,
  };
}

export function useHistoricSignals({
  assetId,
  p_from,
  p_to,
}: {
  assetId: string;
  p_from: string;
  p_to: string;
}) {
  const { data, error, isLoading } = useSWR<SymptomTableResponse, FetcherError>(
    // Pass null to prevent the request from executing
    assetId && p_from && p_to
      ? `/app/api/signals/historic-signals?asset_id=${assetId}&p_from=${p_from}&p_to=${p_to}`
      : null,
    fetcher
  );

  return {
    data,
    isLoading,
    error,
  };
}

export function useHistoricTimeline({
  assetId,
  p_from,
  p_to,
}: {
  assetId: string;
  p_from: string;
  p_to: string;
}) {
  const { data, error, isLoading } = useSWR<any, FetcherError>(
    `/app/api/signals/timeline?asset_id=${assetId}&p_from=${p_from}&p_to=${p_to}`,
    fetcher
  );

  return {
    data,
    isLoading,
    error,
  };
}

export function useSymptomsIcu(condition?: string) {
  const url = condition
    ? `/app/api/symptoms/icu?p_icu_code=${condition}`
    : "/app/api/symptoms/icu";

  const { data, error, isLoading, isValidating, mutate } = useSWR<
    SymptomsICUItemResponse[],
    FetcherError
  >(
    url,
    async (fetchUrl) => {
      const response = await fetch(fetchUrl);
      return safeJsonParse<SymptomsICUItemResponse[]>(response);
    },
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    }
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
  const { data, error, isLoading, mutate } = useSWR<
    MapPosition[],
    FetcherError
  >(
    "/app/api/map",
    async (url: string) => {
      const response = await fetch(url);
      const data = await safeJsonParse<MapPosition[]>(response);
      return data?.map((position: MapPosition) => {
        const [longitude, latitude] = MapService.parseWKBPoint(
          position.location
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
      // Collapse focus/reconnect-driven refetches into one call within the
      // window — this endpoint is concurrency-limited upstream (429 spike
      // arrest), so duplicate bursts must not reach it.
      dedupingInterval: 10_000,
    }
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
  const { data, error, isLoading, mutate } = useSWR<
    MapPositionResume,
    FetcherError
  >(
    "/app/api/map/resume",
    async (url: string) => {
      const response = await fetch(url);
      return safeJsonParse<MapPositionResume>(response);
    },
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    }
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
    fetcher
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
  icuCode: string
) {
  const { data, error, isLoading } = useSWR<
    SympthomTemplateResponse,
    FetcherError
  >(
    `/app/api/treatments/templates?serviceCode=${serviceCode}&conditionName=${conditionName}&icuCode=${icuCode}`,
    fetcher
  );

  return {
    treatments_templates: data,
    treatments_templates_error: error,
    treatments_templates_isLoading: isLoading,
  };
}

export function requestTreatment(
  treatmentRequest: TreatmentsRequest
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

export type BuildComponentInfo = {
  changed?: boolean;
  version?: string;
  tag?: string;
  imageRepository?: string;
  imageTag?: string;
  imageRef?: string;
  sourceTag?: string;
};

export type BuildCredit = {
  name: string;
  email?: string;
  username?: string;
  url?: string;
  role?: string;
};

export type BuildInfo = {
  product: string;
  channel: string;
  releaseVersion: string;
  releaseNotesVersion?: string;
  stackTag?: string;
  gitSha?: string;
  shortSha?: string;
  builtAt?: string;
  deployedAt?: string;
  workflowRunUrl?: string;
  manifestVersion: number;
  credits: BuildCredit[];
  components: Record<string, BuildComponentInfo>;
};

export function useReleases() {
  const { data, error, isLoading } = useSWR<Release[], FetcherError>(
    `/app/api/releases`,
    fetcher
  );

  return {
    releases: data || [],
    error,
    isLoading,
  };
}

export function useBuildInfo() {
  const { data, error, isLoading } = useSWR<BuildInfo, FetcherError>(
    `/app/api/build-info`,
    fetcher
  );

  return {
    buildInfo: data || null,
    error,
    isLoading,
  };
}

export function useTreatmentsLocation(
  tripId: string,
  symptom_name: string,
  /*  first_date: string,
  last_date: string, */
  symptom_id: string
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
    fetcher
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
    fetcher
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
    fetcher
  );

  return {
    data: data?.data ?? [],
    error,
    isLoading,
  };
}

export function useGetTasksById(taskId: string, finished: boolean) {
  const { data, error, isLoading } = useSWR<
    { taskResponse: TaskResponse },
    FetcherError
  >(
    taskId
      ? `/app/api/task/mytasks/details?taskId=${taskId}&finished=${finished}`
      : null,
    fetcher
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
    fetcher
  );
  const pathname = usePathname();

  // Handle 401 errors (session expired) by redirecting to sign-in
  useEffect(() => {
    if (error?.status === 401) {
      // Extract language from pathname (format: /app/[lang]/... or /[lang]/...)
      const pathSegments = pathname.split("/").filter(Boolean);
      // Remove 'app' prefix if present
      const segmentsWithoutApp =
        pathSegments[0] === "app" ? pathSegments.slice(1) : pathSegments;
      // Find the language segment (usually 'es' or 'en')
      const lang =
        segmentsWithoutApp.find(
          (segment) => segment === "es" || segment === "en"
        ) || "es"; // Default to 'es' if not found

      // Redirect to sign-in page with language
      globalThis.location.href = `/${lang}/sign-in`;
    }
  }, [error, pathname]);

  return {
    user_states: data,
    user_states_error: error,
    user_states_isLoading: isLoading,
  };
}

export function requestSovosFingerprintReuse(
  rut: string,
  tripId: string
): Promise<any> {
  const url = `/app/api/sovos/fingerprint-reuse?rut=${rut}&tripId=${tripId}`;
  return fetcher(url);
}

export function validateIdCard(
  idCardRequest: ValidateIdCardRequest
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
  driverSerieId?: string
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

export function useGetNodeChildren(
  nodeId: string | undefined,
  swrConfig?: SWRConfiguration<any, FetcherError>
) {
  const { data, error, isLoading, mutate } = useSWR<any, FetcherError>(
    nodeId ? `/app/api/bento/multimedia?nodeId=${nodeId}` : null,
    fetcher,
    swrConfig
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
  const { data, error, isLoading, mutate } = useGetNodeChildren(nodeId, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 5000,
    errorRetryCount: 3,
    errorRetryInterval: 5000,
  });
  const isUploading = useRef(false);
  const dataRef = useRef(data);
  dataRef.current = data;

  const uploadFile = useCallback(
    async (file: SendableFile, skipRevalidation = false) => {
      if (isUploading.current) return;
      isUploading.current = true;

      // Optimistic update - add the file to the current data
      const currentData = dataRef.current;
      const optimisticData = {
        ...currentData,
        data: {
          ...currentData?.data,
          list: {
            ...currentData?.data?.list,
            entries: [
              ...(currentData?.data?.list?.entries || []),
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

        // Only revalidate if not part of a batch
        if (!skipRevalidation) {
          await mutate();
        }

        return result;
      } catch (error) {
        // If upload fails, revert the optimistic update
        await mutate();
        throw error;
      } finally {
        isUploading.current = false;
      }
    },
    [mutate]
  );

  return {
    data,
    error,
    isLoading,
    uploadFile,
    mutate,
  };
}

export function useGetNodeContents(nodeIds: string[]) {
  const { data, error, isLoading, mutate } = useSWR<any, FetcherError>(
    nodeIds ? `/app/api/bento/document?nodeIds=${nodeIds.join(",")}` : null,
    fetcher
  );

  return {
    data,
    error,
    isLoading,
    mutate,
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
    }
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
    sendableFile.prop_mintral_contentType
  );
  formData.append("prop_cm_name", sendableFile.prop_cm_name);
  formData.append("prop_mimetype", sendableFile.prop_mimetype);
  formData.append("alf_destination", sendableFile.alf_destination);

  return fetcher(url, {
    method: "POST",
    body: formData,
  });
}

export async function renameBentoFile(
  nodeId: string,
  name: string
): Promise<{ success: boolean; message: string }> {
  return fetcher("/app/api/bento/rename", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nodeId, name }),
  });
}

export async function updateBentoCategory(
  nodeId: string,
  category: string
): Promise<{ success: boolean; message: string }> {
  return fetcher("/app/api/bento/properties", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nodeId, properties: { "mintral:contentType": category } }),
  });
}

export async function updateBentoReviewState(
  nodeId: string,
  state: "PENDING" | "APPROVED" | "REJECTED",
  reviewedBy?: string,
  reviewedAt?: string,
  reviewComment?: string
): Promise<{ success: boolean; message: string }> {
  const properties: Record<string, string> = { "mintral:reviewStatus": state };
  if (reviewedBy) properties["mintral:reviewedBy"] = reviewedBy;
  if (reviewedAt) properties["mintral:reviewedAt"] = reviewedAt;
  if (reviewComment) properties["mintral:reviewComment"] = reviewComment;
  return fetcher("/app/api/bento/properties", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nodeId, properties }),
  });
}

export async function moveBentoFile(
  nodeId: string,
  targetTaskId: string
): Promise<{ success: boolean }> {
  return fetcher("/app/api/bento/move", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nodeId, targetTaskId }),
  });
}

export async function deleteBentoMultimedia(
  nodeId: string
): Promise<{ success: boolean; message: string }> {
  return fetcher(`/app/api/bento/delete?nodeId=${encodeURIComponent(nodeId)}`, {
    method: "DELETE",
  });
}

export async function putBentoMultimedia(
  nodeId: string,
  file: File
): Promise<{ success: boolean; message: string; data?: unknown }> {
  const url = "/app/api/bento/update";

  const formData = new FormData();
  formData.append("filedata", file);
  formData.append("nodeId", nodeId);

  return fetcher(url, {
    method: "PUT",
    body: formData,
  });
}

// Content-level forum (per-node discussions)

export function useGetContentDiscussion(contentNodeRef: string | undefined) {
  const { data, error, isLoading, mutate } = useSWR<ForumDiscussionResponse, FetcherError>(
    contentNodeRef
      ? `/app/api/forum/content?contentNodeRef=${encodeURIComponent(contentNodeRef)}`
      : null,
    fetcher
  );

  return { data, error, isLoading, mutate };
}

export async function createContentForumTopic(
  contentNodeRef: string,
  title: string,
  content?: string
): Promise<unknown> {
  return fetcher("/app/api/forum/content", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "topic/create", contentNodeRef, title, content }),
  });
}

export async function replyContentForumPost(
  topic: string,
  parentPost: string,
  content: string,
  author?: string
): Promise<unknown> {
  return fetcher("/app/api/forum/content", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "post/reply", topic, parentPost, title: content, content, author }),
  });
}

export async function deleteContentForumPost(
  topic: string,
  post: string
): Promise<unknown> {
  return fetcher("/app/api/forum/content", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "post/delete", topic, post }),
  });
}

export async function deleteContentForumTopic(
  topic: string
): Promise<unknown> {
  return fetcher("/app/api/forum/content", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "topic/delete", topic }),
  });
}

export function useGetValidation(
  serviceCode: string,
  scope?: string,
  scopeId?: string
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

// Forum SWR hooks
export function useForumDiscussion(params: {
  taskId?: string;
  instanceId?: string;
  serviceCode?: string;
}) {
  const qs = new URLSearchParams();
  if (params.taskId) qs.set("taskId", params.taskId);
  if (params.instanceId) qs.set("instanceId", params.instanceId);
  if (params.serviceCode) qs.set("serviceCode", params.serviceCode);
  const key = `/app/api/forum/discussion${qs.toString() ? `?${qs.toString()}` : ""}`;
  const { data, error, isLoading, mutate } = useSWR<
    ForumDiscussionResponse,
    FetcherError
  >(key, fetcher, {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
  });

  return {
    discussion: data,
    error,
    isLoading,
    mutate,
  };
}

export async function createForumMessage(payload: {
  topic: string;
  content: string;
  title?: string;
}) {
  return fetcher(`/app/api/forum/post`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function createForumTopicClient(payload: {
  bpmPackage: string;
  title: string;
  content?: string;
}) {
  return fetcher(`/app/api/forum/topic`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

// Message Templates and Webhooks SWR hooks

export interface MessageTemplateData {
  nodeRef: string;
  templateId: string;
  templateKind: string;
  engine: string;
  locale?: string;
  content?: string;
  name: string;
  created: string;
  modified: string;
}

export interface WebhookDefinitionData {
  nodeRef: string;
  templateId: string;
  webhookKind: string;
  templateWebhookUrl: string;
  templateRef?: string;
  created: string;
  modified: string;
}

export interface MessageTemplatesResponse {
  templates: MessageTemplateData[];
  meta: {
    total: number;
    kind: number;
    site: string;
    timestamp: string;
  };
}

export interface WebhooksResponse {
  webhooks: WebhookDefinitionData[];
  groupedWebhooks: Record<string, WebhookDefinitionData[]>;
  meta: {
    total: number;
    groups: number;
    site: string;
    timestamp: string;
  };
}

// Message Templates hooks
export function useMessageTemplates(site: string = "mintral", kind?: string) {
  const params = new URLSearchParams({ site });
  if (kind) params.set("kind", kind);

  const { data, error, isLoading, mutate } = useSWR<
    MessageTemplatesResponse,
    FetcherError
  >(`/app/api/admin/message-templates?${params.toString()}`, fetcher, {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
  });

  return {
    templates: data?.templates || [],
    meta: data?.meta,
    error,
    isLoading,
    mutate,
  };
}

// Webhook Definitions hooks
export function useWebhookDefinitions(site: string = "mintral") {
  const { data, error, isLoading, mutate } = useSWR<
    WebhooksResponse,
    FetcherError
  >(`/app/api/admin/webhooks?site=${site}`, fetcher, {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
  });

  return {
    webhooks: data?.webhooks || [],
    groupedWebhooks: data?.groupedWebhooks || {},
    meta: data?.meta,
    error,
    isLoading,
    mutate,
  };
}

// CRUD operations for Message Templates
export async function createMessageTemplateClient(payload: {
  site: string;
  kind: string;
  templateId: string;
  engineExt: string;
  content: string;
}) {
  return fetcher(`/app/api/admin/message-templates`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function updateMessageTemplateClient(payload: {
  template: string;
  content: string;
}) {
  return fetcher(`/app/api/admin/message-templates`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function deleteMessageTemplateClient(templateNodeRef: string) {
  return fetcher(
    `/app/api/admin/message-templates?template=${templateNodeRef}`,
    {
      method: "DELETE",
    }
  );
}

// CRUD operations for Webhook Definitions
export async function createWebhookDefinitionClient(payload: {
  site: string;
  templateId: string;
  webhookUrl: string;
  webhookKind: string;
  template?: string;
}) {
  return fetcher(`/app/api/admin/webhooks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function updateWebhookDefinitionClient(payload: {
  webhookDef: string;
  templateId?: string;
  webhookUrl?: string;
  webhookKind?: string;
  template?: string;
}) {
  return fetcher(`/app/api/admin/webhooks`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function deleteWebhookDefinitionClient(webhookDefNodeRef: string) {
  return fetcher(`/app/api/admin/webhooks?webhookDef=${webhookDefNodeRef}`, {
    method: "DELETE",
  });
}

export interface UserFiltersResponse {
  data: string[];
}

export function useUserFilters() {
  const { data, error, isLoading } = useSWR<UserFiltersResponse, FetcherError>(
    `/app/api/user/filters`,
    fetcher
  );
  return {
    data: data?.data,
    error,
    isLoading,
  };
}

export function useSearchLoad(
  expeditionCode: string | undefined,
  expeditionNumber: string | undefined
) {
  // Build query parameters only for values that exist
  const buildQueryString = () => {
    const params = new URLSearchParams();
    if (expeditionCode) {
      params.append("expeditionCode", expeditionCode);
    }
    if (expeditionNumber) {
      params.append("expeditionNumber", expeditionNumber);
    }
    return params.toString();
  };

  const queryString = buildQueryString();
  const { data, error, isLoading } = useSWR<LoadSearchResponse[], FetcherError>(
    expeditionCode || expeditionNumber
      ? `/app/api/load/search?${queryString}`
      : null,
    fetcher
  );
  return {
    data,
    error,
    isLoading,
  };
}

interface ETAResponse {
  estimatedArrival: string;
  duration: number;
  distance: number;
}

// interface ETAParams {
//   origin: string;
//   destination: string;
//   doubleDriver?: boolean;
//   percentile?: string;
//   startDate?: string;
// }

export function useLiveETA(
  enabled: boolean,
  origin?: string,
  destination?: string,
  mode: string = "calculated"
) {
  // Only fetch when in calculated mode and we have required data
  const shouldFetch = enabled && mode === "calculated" && origin && destination;

  const { data, error, isLoading, mutate } = useSWR<ETAResponse, FetcherError>(
    shouldFetch
      ? `/app/api/task/calculate-eta?origin=${origin}&destination=${destination}`
      : null,
    async (url: string) => {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originGeofence: origin,
          destinationGeofence: destination,
          doubleDriver: false,
          percentile: "p75",
          startDate: new Date().toISOString(),
        }),
      });

      return safeJsonParse<ETAResponse>(response);
    },
    {
      refreshInterval: 60000, // Refresh every minute
      revalidateOnFocus: false,
      dedupingInterval: 10000, // Dedupe requests within 10 seconds
      errorRetryCount: 3,
      errorRetryInterval: 5000,
    }
  );

  return {
    eta: data,
    isLoading,
    error,
    refresh: mutate,
  };
}

// ETA formatting helper functions
export function formatETA(eta: ETAResponse | undefined): string {
  if (!eta) return "";

  const date = new Date(eta.estimatedArrival);
  const hours = Math.floor(eta.duration / 60);
  const minutes = eta.duration % 60;

  return `${date.toLocaleString()} (${hours}h ${minutes}m)`;
}

export function formatArrivalTime(eta: ETAResponse | undefined): string {
  if (!eta) return "";
  return new Date(eta.estimatedArrival).toLocaleString();
}

export function formatDuration(eta: ETAResponse | undefined): string {
  if (!eta) return "";

  const hours = Math.floor(eta.duration / 60);
  const minutes = eta.duration % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

// ============================================================================
// TimeSlot Hooks (Windows and Blocks)
// ============================================================================

// Stable empty array for hooks to prevent infinite re-renders
const EMPTY_TIME_SLOTS: TimeSlotResponse[] = [];

/**
 * Hook to fetch all time slots, optionally filtered by kind
 * @param kind - Optional filter: "window" | "block" | undefined (all)
 */
export function useTimeSlots(kind?: "window" | "block") {
  const queryParams = new URLSearchParams();
  if (kind) queryParams.set("kind", kind);

  const url = queryParams.toString()
    ? `/app/api/time-slot?${queryParams.toString()}`
    : "/app/api/time-slot";

  const { data, error, isLoading, mutate } = useSWR<
    TimeSlotListResponse,
    FetcherError
  >(url, fetcher, {
    // Disable error retry to prevent infinite loops when API is unavailable
    errorRetryCount: 3,
    errorRetryInterval: 5000,
  });

  return {
    // Use stable empty array reference to prevent infinite re-renders
    timeSlots: data?.data ?? EMPTY_TIME_SLOTS,
    total: data?.total ?? 0,
    error,
    isLoading,
    refresh: mutate,
  };
}

/**
 * Hook to fetch only time windows (kind="window")
 */
export function useTimeWindows() {
  return useTimeSlots("window");
}

/**
 * Hook to fetch only time blocks (kind="block")
 */
export function useTimeBlocks() {
  return useTimeSlots("block");
}

/**
 * Hook to fetch a single time slot by ID
 */
export function useTimeSlot(id: string | null) {
  const { data, error, isLoading, mutate } = useSWR<
    TimeSlotResponse,
    FetcherError
  >(id ? `/app/api/time-slot/${id}` : null, fetcher);

  return {
    timeSlot: data,
    error,
    isLoading,
    refresh: mutate,
  };
}

/**
 * Create a new time slot
 */
export async function createTimeSlot(
  request: CreateTimeSlotRequest
): Promise<TimeSlotResponse> {
  const response = await fetch("/app/api/time-slot", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to create time slot");
  }

  return response.json();
}

/**
 * Update an existing time slot
 */
export async function updateTimeSlot(
  id: string,
  request: UpdateTimeSlotRequest
): Promise<TimeSlotResponse> {
  const response = await fetch(`/app/api/time-slot/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to update time slot");
  }

  return response.json();
}

/**
 * Delete a time slot
 */
export async function deleteTimeSlot(id: string): Promise<void> {
  const response = await fetch(`/app/api/time-slot/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to delete time slot");
  }
}

/**
 * Delete a dashboard config (client-side).
 */
export async function deleteDashboardConfigClient(
  site: string,
  slug: string
): Promise<void> {
  const response = await fetch("/app/api/dashboard/config", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ site, slug }),
  });

  if (!response.ok) {
    throw new Error(`Failed to delete dashboard (${response.status})`);
  }
}

/**
 * SWR hook for the current user's capabilities on a dashboard node.
 * Drives UI gating for edit mode and the settings dropdown.
 */
export type DashboardAccess = {
  canEdit: boolean;
  canManagePermissions: boolean;
};

export function useDashboardAccess(
  site: string | null | undefined,
  slug: string | null | undefined
) {
  const key =
    site && slug
      ? `/app/api/dashboard/${encodeURIComponent(site)}/${encodeURIComponent(slug)}/access`
      : null;

  const { data, error, isLoading } = useSWR<DashboardAccess, FetcherError>(
    key,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  );

  return {
    canEdit: data?.canEdit ?? false,
    canManagePermissions: data?.canManagePermissions ?? false,
    isLoading,
    error,
  };
}

// ============================================================================
// Calendar Hooks
// ============================================================================

const EMPTY_CALENDARS: CalendarResponse[] = [];

/**
 * Hook to fetch all active calendars (with their groups)
 */
export function useCalendars() {
  const { data, error, isLoading, mutate } = useSWR<
    CalendarResponse[],
    FetcherError
  >("/app/api/calendar", fetcher, {
    errorRetryCount: 3,
    errorRetryInterval: 5000,
  });
  return {
    calendars: data ?? EMPTY_CALENDARS,
    error,
    isLoading,
    refresh: mutate,
  };
}

/**
 * Filters cached calendar data by group code — no extra network request
 */
export function useCalendarsInGroup(groupCode: string | null) {
  const { calendars, isLoading, refresh, error } = useCalendars();
  const filtered = useMemo(
    () =>
      groupCode
        ? calendars.filter((cal) =>
            cal.groups?.some((g) => g.code === groupCode)
          )
        : EMPTY_CALENDARS,
    [calendars, groupCode]
  );
  return { calendars: filtered, isLoading, refresh, error };
}

const EMPTY_GROUPS: CalendarGroupResponse[] = [];

/**
 * Hook to fetch all active calendar groups
 */
export function useCalendarGroups() {
  const { data, error, isLoading, mutate } = useSWR<
    CalendarGroupResponse[],
    FetcherError
  >("/app/api/calendar/groups", fetcher, {
    errorRetryCount: 3,
    errorRetryInterval: 5000,
  });
  return { groups: data ?? EMPTY_GROUPS, error, isLoading, refresh: mutate };
}

async function throwApiError(
  response: Response,
  fallback: string
): Promise<never> {
  const text = await response.text().catch(() => "");
  let message: string;
  let info: string | null = null;
  try {
    const json = JSON.parse(text) as { error?: string };
    message = `[${response.status}] ${json.error ?? fallback}`;
    info = text;
  } catch {
    message = `[${response.status}] ${text || fallback}`;
    info = text || null;
  }
  const code =
    response.status >= 500
      ? FetcherErrorCode.SERVER_ERROR
      : FetcherErrorCode.CLIENT_ERROR;
  throw createFetcherError(message, response.status, code, info);
}

/**
 * Create a new calendar group
 */
export async function createCalendarGroup(
  body: CalendarGroupRequest
): Promise<CalendarGroupResponse> {
  const response = await fetch("/app/api/calendar/groups", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    await throwApiError(response, "Failed to create calendar group");
  }
  return response.json();
}

/**
 * Create a new calendar
 */
export async function createCalendar(
  body: CalendarRequest
): Promise<CalendarResponse> {
  const response = await fetch("/app/api/calendar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    await throwApiError(response, "Failed to create calendar");
  }
  return response.json();
}

/**
 * Update an existing calendar (partial update — merges with current on the server)
 */
export async function updateCalendar(
  calendarId: string,
  body: Partial<CalendarRequest>
): Promise<CalendarResponse> {
  const response = await fetch(`/app/api/calendar/${calendarId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Failed to update calendar: ${response.statusText}`);
  }
  return response.json();
}

// ============================================================================
// Calendar Time Windows Hooks
// ============================================================================

const EMPTY_TIME_WINDOWS: TimeWindowResponse[] = [];

/**
 * Fetch time windows for a specific calendar from the miot-calendar-client backend.
 * Returns null SWR key (no fetch) when calendarId is null/undefined.
 */
export function useCalendarTimeWindows(calendarId: string | null) {
  const url = calendarId
    ? `/app/api/calendar/${calendarId}/time-windows`
    : null;

  const { data, error, isLoading, mutate } = useSWR<
    TimeWindowResponse[],
    FetcherError
  >(url, fetcher, {
    errorRetryCount: 3,
    errorRetryInterval: 5000,
  });

  return {
    timeWindows: data ?? EMPTY_TIME_WINDOWS,
    error,
    isLoading,
    refresh: mutate,
  };
}

/**
 * Create a new time window for the given calendar.
 */
export async function createCalendarTimeWindow(
  calendarId: string,
  body: TimeWindowRequest
): Promise<TimeWindowResponse> {
  const response = await fetch(`/app/api/calendar/${calendarId}/time-windows`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    await throwApiError(response, "Failed to create time window");
  }
  return response.json();
}

/**
 * Update an existing time window.
 */
export async function updateCalendarTimeWindow(
  calendarId: string,
  timeWindowId: string,
  body: TimeWindowRequest
): Promise<TimeWindowResponse> {
  const response = await fetch(
    `/app/api/calendar/${calendarId}/time-windows/${timeWindowId}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  if (!response.ok) {
    await throwApiError(response, "Failed to update time window");
  }
  return response.json();
}

/**
 * Deactivate (soft-delete) a time window by setting active=false.
 * Requires the existing window data to satisfy required API fields.
 */
export async function deactivateCalendarTimeWindow(
  calendarId: string,
  window: TimeWindowResponse
): Promise<void> {
  await updateCalendarTimeWindow(calendarId, window.id, {
    name: window.name,
    startHour: window.startHour,
    endHour: window.endHour,
    validFrom: window.validFrom,
    ...(window.validTo ? { validTo: window.validTo } : {}),
    daysOfWeek: window.daysOfWeek,
    capacity: window.capacity,
    active: false,
  });
}

// ============================================================================
// Calendar Slots Hook
// ============================================================================

const EMPTY_SLOTS: SlotResponse[] = [];

/**
 * Fetch slots for a specific calendar and date from the miot-calendar-client backend.
 * Returns null SWR key (no fetch) when calendarId or date is missing.
 */
export function useCalendarSlots(
  calendarId: string | null,
  date: string | null
) {
  const url =
    calendarId && date
      ? `/app/api/calendar/slots?calendarId=${calendarId}&startDate=${date}&endDate=${date}`
      : null;

  const { data, error, isLoading, mutate } = useSWR<
    SlotListResponse,
    FetcherError
  >(url, fetcher, {
    errorRetryCount: 3,
    errorRetryInterval: 5000,
  });

  return {
    slots: data?.data ?? EMPTY_SLOTS,
    error,
    isLoading,
    refresh: mutate,
  };
}

// ============================================================================
// Booking Helpers
// ============================================================================

/**
 * Process-scope variable tuple set on the workflow before completing the
 * task — populated by the planner's task-driven ASSIGN move so the
 * `OnCreatePresentDriverBinding` ECM listener can read the resource tuple
 * from process scope on the `presentDriver` create. Mirrors the assigned-
 * stage binding payload field set (snake_case). See
 * `docs/plans/calendar-task-driven-frontend-P0-spike.md` §2.2.
 */
export type AssignProcessVariables = {
  carrier_id: string;
  driver_id: string;
  driver2_id: string | null;
  truck_id: string;
  trailer_id: string | null;
  carrier_external_id: string | null;
  tipo_servicio: string;
};

/**
 * Process-scope variable tuple set on the workflow before completing the
 * task — populated by the planner's task-driven PLAN move so ECM's
 * `OnCreateAssignDriverBinding` listener can write the `cld_bookings` row
 * itself on the `assignDriver` create (ecm-coordinator#266 E2). All values
 * are strings to match the `processVariables` body shape that
 * `POST /alfresco/s/mintral/tasks/end` validates (ecm-coordinator#262).
 */
export type PlanProcessVariables = {
  calendar_id: string;
  slot_date: string;
  slot_hour: string;
  slot_minutes: string;
  /**
   * Optional category from the planner sidebar form. ECM's
   * `EndTaskPostWebscript` accepts the key (ecm-coordinator#270) and
   * `OnCreateAssignDriverBinding` then persists it onto the booking row
   * (#268). Omitted when blank.
   */
  mintral_serviceCategory?: string;
};

export type TaskMoveProcessVariables =
  | AssignProcessVariables
  | PlanProcessVariables;

/**
 * Optional Alfresco workflow advance to bundle with a booking write. The
 * server runs the booking and the task transition as one operation and rolls
 * back the just-created booking if the transition fails.
 */
export type BookingTaskAdvance = {
  taskId: string;
  transitionId: string;
  /**
   * Optional process-scope variables to set on the workflow before the task
   * is completed: the ASSIGN tuple on the assignDriver → presentDriver move,
   * or the SLOT tuple on the planService → assignDriver move. For task-
   * driven origins both tuples also signal the FE to skip the booking
   * POST/PUT — ECM owns the `cld_bookings` row (created on assignDriver,
   * updated on presentDriver). When omitted the task advance is a plain
   * GET as today.
   */
  processVariables?: TaskMoveProcessVariables;
};

export type CreateBookingRequest = BookingRequest & {
  taskAdvance?: BookingTaskAdvance;
};

/**
 * Create a booking for a calendar slot resource.
 */
export async function createBooking(
  body: CreateBookingRequest
): Promise<BookingResponse> {
  const response = await fetch("/app/api/calendar/bookings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error ?? "Failed to create booking");
  }
  return response.json();
}

/**
 * Advance an Alfresco workflow task to the next stage via the given transition.
 * Called after booking and service-category sync are confirmed so that the
 * workflow only moves when both writes have succeeded. When
 * `processVariables` is supplied the call sets the workflow's PROCESS-scope
 * variables before completing the task — used by the planner's task-driven
 * ASSIGN move (assignDriver → presentDriver) so the
 * `OnCreatePresentDriverBinding` listener can read the resource tuple.
 */
export async function advanceWorkflowTask(
  taskId: string,
  transitionId: string,
  processVariables?: TaskMoveProcessVariables
): Promise<void> {
  const body: Record<string, unknown> = { taskId, transitionId };
  if (processVariables) {
    body.processVariables = processVariables;
  }
  const response = await fetch("/app/api/task/end", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const err = (await response.json().catch(() => ({}))) as {
      error?: { message?: string } | string;
    };
    const message =
      typeof err.error === "string"
        ? err.error
        : (err.error?.message ?? "Failed to advance workflow task");
    throw new Error(message);
  }
}

/**
 * Update an existing booking's resource payload in place (same slot). Used to
 * push a changed payload — e.g. the assignment tuple — onto a booking that
 * already exists, since the bookings POST resolves a same-slot conflict by
 * returning the existing booking without applying the new data.
 */
export async function updateBooking(
  bookingId: string,
  body: BookingUpdateRequest
): Promise<BookingResponse> {
  const response = await fetch(`/app/api/calendar/bookings/${bookingId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error ?? "Failed to update booking");
  }
  return response.json();
}

/**
 * Atomically reassign a booking. The server re-points the booking row at the
 * new slot (and optionally refreshes its resource payload) in one transaction
 * — the booking id is preserved, no row is created or deleted. A same-slot
 * call collapses to a payload-only update, which is why the planner can route
 * both "Reasignar" and "Asignar"-on-already-planned through here.
 */
export async function moveBooking(
  bookingId: string,
  body: MoveBookingRequest
): Promise<BookingResponse> {
  const response = await fetch(
    `/app/api/calendar/bookings/${bookingId}/move`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error ?? "Failed to move booking");
  }
  return response.json();
}

/**
 * Cancel an existing booking by ID.
 */
export async function cancelBooking(bookingId: string): Promise<void> {
  const response = await fetch(`/app/api/calendar/bookings/${bookingId}`, {
    method: "DELETE",
  });
  if (!response.ok && response.status !== 204) {
    const err = await response.json();
    throw new Error(err.error ?? "Failed to cancel booking");
  }
}

/** Stage values accepted by the coordinator's calendar binding webscript. */
export type CalendarBindingStage =
  | "planned"
  | "assigned"
  | "unassigned"
  | "none";

/**
 * Tell the coordinator that a (service, calendar) binding changed. Used
 * for ops fired from the client *after* a separate API call (cancel,
 * calendar-change, unassign) — the bookings POST flow handles its own
 * binding update inline.
 *
 * Tuple fields are only honoured by the coordinator when stage="assigned".
 */
export async function notifyCalendarBinding(payload: {
  numero_servicio: string;
  calendar_id: string;
  stage: CalendarBindingStage;
  tipo_servicio?: string;
  carrier_id?: string;
  driver_id?: string;
  driver2_id?: string | null;
  truck_id?: string;
  trailer_id?: string | null;
}): Promise<void> {
  const response = await fetch("/app/api/calendar/binding", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const message =
      typeof err.error === "string"
        ? err.error
        : "Calendar binding update failed";
    throw new Error(message);
  }
}

const BookingListResponseSchema = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      calendarId: z.string(),
      resource: z.object({
        id: z.string(),
        type: z.string().nullable().optional(),
        label: z.string().nullable().optional(),
        data: z.record(z.string(), z.unknown()).nullable().optional(),
      }),
      slot: z
        .object({
          date: z.string(),
          hour: z.number(),
          minutes: z.number(),
        })
        .nullable(),
      createdAt: z.string(),
      createdBy: z.string().nullable().optional(),
    })
  ),
  total: z.number(),
});

/**
 * List bookings for a calendar, optionally filtered by date range.
 */
export async function listBookings(
  params?: { calendarId?: string; startDate?: string; endDate?: string },
  signal?: AbortSignal
): Promise<BookingListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.calendarId) searchParams.set("calendarId", params.calendarId);
  if (params?.startDate) searchParams.set("startDate", params.startDate);
  if (params?.endDate) searchParams.set("endDate", params.endDate);
  const query = searchParams.toString();
  const url = query
    ? `/app/api/calendar/bookings?${query}`
    : "/app/api/calendar/bookings";
  const response = await fetch(url, { method: "GET", signal });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error ?? "Failed to list bookings");
  }
  const json = await response.json();
  const parsed = BookingListResponseSchema.safeParse(json);
  if (!parsed.success) {
    if (process.env.NODE_ENV !== "production") {
      console.error(
        "BookingListResponse validation warning:",
        parsed.error.issues
      );
    }
    if (!Array.isArray((json as BookingListResponse).data)) {
      throw new TypeError("Invalid booking list response format");
    }
    return json as BookingListResponse;
  }
  return parsed.data as BookingListResponse;
}

export function useServiceTypes() {
  const { data, error, isLoading } = useSWR<ServiceType[], FetcherError>(
    "/app/api/service-types",
    fetcher,
    { errorRetryCount: 3, errorRetryInterval: 5000 }
  );
  return {
    serviceTypes: (data ?? []).filter((t) => t.isActive),
    error,
    isLoading,
  };
}

/**
 * Active content-review observation reasons, ordered by `position` (missing
 * positions last) then name. Backed by the Alfresco "Tipos de Observación"
 * data list via the BFF route. Consumers fall back to the static
 * OBSERVATION_TYPE_KEYS when this returns empty (loading / error).
 */
export function useObservationTypes(category?: string | null) {
  const key = category
    ? `/app/api/observation-types?appliesTo=${encodeURIComponent(category)}`
    : "/app/api/observation-types";
  const { data, error, isLoading } = useSWR<ObservationTypeItem[], FetcherError>(
    key,
    fetcher,
    { errorRetryCount: 3, errorRetryInterval: 5000 }
  );
  const observationTypes = useMemo(
    () =>
      (data ?? [])
        .filter((t) => t.isActive)
        .sort(
          (a, b) =>
            (a.position ?? Number.MAX_SAFE_INTEGER) -
              (b.position ?? Number.MAX_SAFE_INTEGER) ||
            a.name.localeCompare(b.name)
        ),
    [data]
  );
  return { observationTypes, error, isLoading };
}

/**
 * Resolve a service-type code (e.g. "ST001") to its display name.
 *
 * Unlike {@link useServiceTypes} this does not drop inactive types, so a task
 * referencing a now-retired category still renders its label. Backed by the
 * same SWR cache key, so it adds no extra requests when used alongside it.
 */
export function useServiceCategoryName(code: string | null | undefined): {
  name: string | undefined;
  isLoading: boolean;
} {
  const { data, isLoading } = useSWR<ServiceType[], FetcherError>(
    "/app/api/service-types",
    fetcher,
    { errorRetryCount: 3, errorRetryInterval: 5000 }
  );
  const name = useMemo(() => {
    if (!code) return undefined;
    return (data ?? []).find((t) => t.code === code)?.name;
  }, [data, code]);
  return { name, isLoading };
}

export async function updateServiceCategory(
  taskId: string,
  serviceTypeCode: string
): Promise<void> {
  const response = await fetch("/app/api/planning/service-type", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ taskId, serviceTypeCode }),
  });
  if (!response.ok)
    throw new Error(`updateServiceCategory: ${response.status}`);
}
