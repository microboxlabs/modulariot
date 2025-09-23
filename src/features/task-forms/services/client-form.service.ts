"use client";

// import fetcher from "@/features/common/providers/fetcher";
import fetcher from "@/features/common/providers/fetcher";
import { GPSValidityType, TaskNextActionState } from "./form.service.types";
import { GetEntityInfoResponse } from "@/features/common/providers/microboxlabs-api/microboxlabs-api.types";

import { ShowNotification } from "@/features/notifications/notification";
import { FetcherError } from "@/features/common/providers/fetcher.types";
import { InfoError } from "@/features/common/providers/alfresco-api/alfresco-api.types";

async function fetcherClient<T>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<T> {
  try {
    return await fetcher<T>(input, init);
  } catch (error) {
    const fetcherError = error as FetcherError;
    let errorMessage = fetcherError.message;

    if (typeof fetcherError?.info === "string") {
      const parsedError = JSON.parse(fetcherError.info) as Record<
        string,
        InfoError
      >;
      if (parsedError?.error?.message) {
        errorMessage = parsedError.error.message;
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (fetcherError?.info?.error?.code === "ALERCE_LOGIN_ERROR") {
      errorMessage =
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        (fetcherError?.info?.error?.message as string) ??
        "Error al iniciar sesión";
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    } else if (fetcherError?.info?.error?.code === "ERROR_ACCION") {
      errorMessage =
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        (fetcherError?.info?.error?.details?.involvedObject
          ?.respuesta as string) ?? "Error al realizar la acción";
    } else if (
      fetcherError?.info?.error?.code === "DUPLICATE_LICENSE_PLATE_ERROR"
    ) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      errorMessage =
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        fetcherError?.info?.error?.message ?? "Error al realizar la acción";
    }
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

export async function taskNextAction(
  _prevState: TaskNextActionState,
  formData: FormData
): Promise<TaskNextActionState> {
  const taskId = formData.get("taskId") as string;
  const transitionId = formData.get("transitionId");
  const comments = formData.get("comments");
  const nativeGenerationEnabled = formData.get("nativeGenerationEnabled");

  const reasonId = formData.get("reasonId");
  const reason = formData.get("reason");
  const reasons = formData.get("reasons");
  const isMultiReason = formData.get("isMultiReason");

  return fetcherClient<TaskNextActionState>("/app/api/task/end", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      taskId,
      transitionId,
      comments,
      nativeGenerationEnabled,
      reasonId,
      reason,
      reasons,
      isMultiReason,
    }),
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
