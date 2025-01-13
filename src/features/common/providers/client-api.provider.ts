import useSWR from "swr";
import fetcher from "./fetcher";
import { FetcherError } from "./fetcher.types";
import { KanbanBoardTaskResponse } from "@/features/shipping/types/common.types";
import {
  DownloadDocumentResponse,
  ServiceValidationResponse,
  TaskCountResponse,
  VerifyDocumentResponse,
} from "./alfresco-api/alfresco-api.types";
import { GetEntityInfoResponse } from "./microboxlabs-api/microboxlabs-api.types";

// export function useI8n(lang: string) {
//   const { data, error, isLoading } = useSWR(`/api/i18n/${lang}`, fetcher);
//   return {
//     dict: data,
//     error,
//     isLoading,
//   };
// }

export function useMyTasks(columns: string[]) {
  const qs = columns.map((column) => `columns=${column}`).join("&");
  const { data, error, isLoading } = useSWR<
    KanbanBoardTaskResponse,
    FetcherError
  >(`/app/api/task/mytasks?${qs}`, fetcher);
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
