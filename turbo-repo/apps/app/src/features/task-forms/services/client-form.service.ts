"use client";

// import fetcher from "@/features/common/providers/fetcher";
import fetcher from "@/features/common/providers/fetcher";
import { GPSValidityType, TaskNextActionState } from "./form.service.types";
import { GetEntityInfoResponse } from "@/features/common/providers/microboxlabs-api/microboxlabs-api.types";

import { ShowNotification } from "@/features/notifications/notification";
import {
  FetcherError,
  FetcherErrorInfo,
} from "@/features/common/providers/fetcher.types";
import { InfoError } from "@/features/common/providers/alfresco-api/alfresco-api.types";

/**
 * Attempts to extract error message from string info
 */
function parseErrorMessageFromString(info: string): string | null {
  try {
    const parsedError = JSON.parse(info) as Record<string, InfoError>;
    return parsedError?.error?.message ?? null;
  } catch {
    return null;
  }
}

/**
 * Extracts the best error message from a FetcherError
 *
 * NOTE: Simplified for testing centralized error handling in fetcher.ts
 */
function extractErrorMessage(fetcherError: FetcherError): string {
  if (typeof fetcherError.info === "string") {
    const message = parseErrorMessageFromString(fetcherError.info);
    if (message) {
      return message;
    }
  }

  return fetcherError.message;
}

async function fetcherClient<T>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<T> {
  try {
    return await fetcher<T>(input, init);
  } catch (error) {
    const fetcherError = error as FetcherError;
    const errorMessage = extractErrorMessage(fetcherError);

    ShowNotification({
      message: errorMessage,
      type: "error",
    });
    return {
      success: false,
      error: fetcherError.message,
    } as T;
  }
}

/**
 * Keys whose string values "true"/"false" should be coerced to booleans.
 */
const BOOLEAN_KEYS: ReadonlySet<string> = new Set(["isMultiReason"]);

/**
 * Converts FormData to a plain object, handling special cases for JSON strings
 */
export function formDataToObject(formData: FormData): Record<string, unknown> {
  const obj: Record<string, unknown> = {};

  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && BOOLEAN_KEYS.has(key)) {
      obj[key] = value === "true";
    } else if (
      typeof value === "string" &&
      (value.startsWith("[") || value.startsWith("{"))
    ) {
      try {
        obj[key] = JSON.parse(value);
      } catch {
        obj[key] = value;
      }
    } else {
      obj[key] = value;
    }
  }

  return obj;
}

export async function taskNextAction(
  _prevState: TaskNextActionState,
  formData: FormData
): Promise<TaskNextActionState> {
  // Convert all FormData entries to a plain object dynamically
  const payload = formDataToObject(formData);

  return fetcherClient<TaskNextActionState>("/app/api/task/end", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export async function taskSignDocument(
  _prevState: TaskNextActionState,
  formData: FormData
): Promise<TaskNextActionState> {
  const taskId = formData.get("taskId") as string;
  const transitionId = formData.get("transitionId");
  const serviceCode = formData.get("serviceCode");
  const taskType = formData.get("taskType");
  const signerRuts = (formData.get("signerRuts") ?? "") as string;
  const auditNumbers = (formData.get("auditNumbers") ?? "") as string;

  return fetcherClient("/app/api/task/sign", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      taskId,
      transitionId,
      serviceCode,
      bpmPackage: formData.get("bpmPackage"),
      signerRuts: signerRuts.split(","),
      auditNumbers: auditNumbers.split(","),
      taskType,
    }),
  });
}

export async function taskSignIdCardDocument(
  _prevState: TaskNextActionState,
  formData: FormData
): Promise<TaskNextActionState> {
  const taskId = formData.get("taskId") as string;
  const transitionId = formData.get("transitionId");
  const serviceCode = formData.get("serviceCode");
  const taskType = formData.get("taskType");
  const signerRuts = (formData.get("signerRuts") ?? "") as string;
  const auditNumbers = (formData.get("auditNumbers") ?? "") as string;
  const serialNumbers = (formData.get("serialNumbers") ?? "") as string;
  const documentName = (formData.get("documentName") ?? "") as string;

  return fetcherClient("/app/api/task/id-card-sign", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      taskId,
      transitionId,
      serviceCode,
      bpmPackage: formData.get("bpmPackage"),
      signerRuts, //: signerRuts.split(","),
      auditNumbers, //: auditNumbers, //.split(","),
      nro_serie: serialNumbers, //: serialNumbers, //.split(","),
      documentName,
      taskType,
    }),
  });
}

/**
 * Calcula el tipo de validación GPS basado en el último timestamp de la entidad.
 * La regla definida es:
 * - Menos de 30 minutos: "ok"
 * - Entre 30 y 60 minutos: "warning"
 * - Más de 60 minutos: "error"
 * @param entityInfo Información de la entidad obtenida desde la API de Microboxlabs.
 * @returns El tipo de validación GPS ("ok", "warning", "error").
 */
export function calcGpsValidationType(
  entityInfo: GetEntityInfoResponse
): GPSValidityType {
  const { ultimo_last_timestamp } = entityInfo;
  const lastTimestamp = new Date(`${ultimo_last_timestamp}Z`);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - lastTimestamp.getTime());
  const diffSeconds = Math.round(diffTime / 1000);
  if (diffSeconds < 1800) return "ok";
  if (diffSeconds >= 1800 && diffSeconds < 3600) return "warning";
  return "error";
}

export function toLatLngLiteral(coordinates: {
  type: string;
  coordinates: [number, number];
}): google.maps.LatLngLiteral {
  return {
    lat: coordinates.coordinates[1],
    lng: coordinates.coordinates[0],
  };
}

/**
 * Response type for updateTaskProperties
 */
export type UpdateTaskPropertiesResponse = {
  success: boolean;
  error?: string;
  updatedProperties?: Record<string, unknown>;
};

/**
 * Updates task properties without ending the task.
 * This is used for inline editing in bento components.
 *
 * @param taskId - The task ID to update
 * @param properties - Object containing property names and values to update
 * @returns Promise with the update result
 *
 * @example
 * ```typescript
 * // Update arrival date
 * await updateTaskProperties("123456", {
 *   mintral_arrivalDate: "2025-01-15T10:30:00Z"
 * });
 * ```
 */
export async function updateTaskProperties(
  taskId: string,
  properties: Record<string, unknown>
): Promise<UpdateTaskPropertiesResponse> {
  return fetcherClient<UpdateTaskPropertiesResponse>("/app/api/task/update", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      taskId,
      properties,
    }),
  });
}
