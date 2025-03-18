"use client";

// import fetcher from "@/features/common/providers/fetcher";
import fetcher from "@/features/common/providers/fetcher";
import { GPSValidityType, TaskNextActionState } from "./form.service.types";
import { GetEntityInfoResponse } from "@/features/common/providers/microboxlabs-api/microboxlabs-api.types";

import { ShowNotification } from "@/features/notifications/notification";
import { FetcherError } from "@/features/common/providers/fetcher.types";

async function fetcherClient<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<T> {
  try {
    return await fetcher<T>(input, init);
  } catch (error) {
    const fetcherError = error as FetcherError;
    let errorMessage = fetcherError.message;
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
  formData: FormData,
): Promise<TaskNextActionState> {
  const taskId = formData.get("taskId") as string;
  const transitionId = formData.get("transitionId");
  const comments = formData.get("comments");
  return fetcherClient<TaskNextActionState>("/app/api/task/end", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      taskId,
      transitionId,
      comments,
    }),
  });
}

export async function taskSignDocument(
  _prevState: TaskNextActionState,
  formData: FormData,
): Promise<TaskNextActionState> {
  const taskId = formData.get("taskId") as string;
  const transitionId = formData.get("transitionId");
  const serviceCode = formData.get("serviceCode");
  const taskType = formData.get("taskType");

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
      signerRuts: (formData.get("signerRuts") as string).split(","),
      auditNumbers: (formData.get("auditNumbers") as string).split(","),
      taskType,
    }),
  });
}

/**
 * Calcula el tipo de validación GPS basado en el último timestamp de la entidad.
 * La regla definida es:
 * - Menos de 2 minutos: "ok"
 * - Entre 2 y 5 minutos: "warning"
 * - Más de 5 minutos: "error"
 * @param entityInfo Información de la entidad obtenida desde la API de Microboxlabs.
 * @returns El tipo de validación GPS ("ok", "warning", "error").
 */
export function calcGpsValidationType(
  entityInfo: GetEntityInfoResponse,
): GPSValidityType {
  const { ultimo_last_timestamp } = entityInfo;
  const lastTimestamp = new Date(`${ultimo_last_timestamp}Z`);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - lastTimestamp.getTime());
  const diffSeconds = Math.round(diffTime / 1000);
  if (diffSeconds < 120) return "ok";
  if (diffSeconds >= 120 && diffSeconds < 300) return "warning";
  return "error";
}

export function toLatLngLiteral(
  // eslint-disable-next-line no-undef
  coordinates: {
    type: string;
    coordinates: [number, number];
  },
  // eslint-disable-next-line no-undef
): google.maps.LatLngLiteral {
  // eslint-disable-next-line no-undef
  return {
    lat: coordinates.coordinates[1],
    lng: coordinates.coordinates[0],
  };
}
