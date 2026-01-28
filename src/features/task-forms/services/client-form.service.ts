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
 * Type guard to check if info has the expected error structure
 */
function hasErrorInfo(
  info: unknown
): info is FetcherErrorInfo & { error: NonNullable<FetcherErrorInfo["error"]> } {
  return (
    typeof info === "object" &&
    info !== null &&
    "error" in info &&
    typeof (info as FetcherErrorInfo).error === "object" &&
    (info as FetcherErrorInfo).error !== null
  );
}

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
 * Gets error message based on error code
 * 
 * NOTE: Commented out for testing centralized error handling in fetcher.ts
 * If the centralized fix works, this function can be removed.
 * See: https://github.com/... (link to issue)
 */
// function getErrorMessageFromCode(
//   errorInfo: NonNullable<FetcherErrorInfo["error"]>
// ): string | null {
//   if (errorInfo.code === "ALERCE_LOGIN_ERROR") {
//     return errorInfo.message ?? "Error al iniciar sesión";
//   }
//   if (errorInfo.code === "ERROR_ACCION") {
//     return (
//       errorInfo.details?.involvedObject?.respuesta ??
//       "Error al realizar la acción"
//     );
//   }
//   if (errorInfo.code === "DUPLICATE_LICENSE_PLATE_ERROR") {
//     return errorInfo.message ?? "Error al realizar la acción";
//   }
//   return null;
// }

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

  // NOTE: Commented out for testing - getErrorMessageFromCode should no longer be needed
  // if (hasErrorInfo(fetcherError.info)) {
  //   const message = getErrorMessageFromCode(fetcherError.info.error);
  //   if (message) {
  //     return message;
  //   }
  // }

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
 * Converts FormData to a plain object, handling special cases for JSON strings
 */
function formDataToObject(formData: FormData): Record<string, unknown> {
  const obj: Record<string, unknown> = {};

  for (const [key, value] of formData.entries()) {
    // Try to parse JSON strings (like "reasons" field)
    if (typeof value === "string" && (value.startsWith("[") || value.startsWith("{"))) {
      try {
        obj[key] = JSON.parse(value);
      } catch {
        // If parsing fails, keep as string
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

export function toLatLngLiteral(
  // eslint-disable-next-line no-undef
  coordinates: {
    type: string;
    coordinates: [number, number];
  }
  // eslint-disable-next-line no-undef
): google.maps.LatLngLiteral {
  // eslint-disable-next-line no-undef
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
