// "use client";

// import fetcher from "@/features/common/providers/fetcher";
import fetcher from "@/features/common/providers/fetcher";
import { GPSValidityType, TaskNextActionState } from "./form.service.types";
import { GetEntityInfoResponse } from "@/features/common/providers/microboxlabs-api/microboxlabs-api.types";

export async function taskNextAction(
  _prevState: TaskNextActionState,
  formData: FormData,
): Promise<TaskNextActionState> {
  const taskId = formData.get("taskId") as string;
  const transitionId = formData.get("transitionId");
  const comments = formData.get("comments");
  return fetcher("/app/api/task/end", {
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

  return fetcher("/app/api/task/sign", {
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
