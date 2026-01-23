import type {
  PlannedService as LocalPlannedService,
  SelectedService,
  SelectedSlot,
  LeadTimeData,
} from "../components/planning/planning-selection-context";
import type {
  PlannedServiceResponse,
  Service,
  Slot,
} from "../types/planned-service.types";

/**
 * Convert API PlannedServiceResponse to local PlannedService format
 */
export function apiToLocalPlannedService(
  apiResponse: PlannedServiceResponse
): LocalPlannedService {
  return {
    service: apiToLocalService(apiResponse.service),
    slot: {
      date: new Date(apiResponse.slot.date),
      hour: apiResponse.slot.hour,
      minutes: apiResponse.slot.minutes,
    },
  };
}

/**
 * Convert local PlannedService to API format
 */
export function localToApiPlannedService(local: LocalPlannedService): {
  service: Service;
  slot: { date: string; hour: number; minutes: number };
} {
  return {
    service: localServiceToApi(local.service),
    slot: {
      date:
        local.slot.date instanceof Date
          ? local.slot.date.toISOString().split("T")[0]
          : String(local.slot.date),
      hour: local.slot.hour,
      minutes: local.slot.minutes,
    },
  };
}

/**
 * Convert API Service to local SelectedService format
 */
function apiToLocalService(apiService: Service): SelectedService {
  return {
    id: apiService.id,
    cliente: apiService.cliente,
    origen: apiService.origen,
    lugarCarguio: apiService.origen, // Map origen to lugarCarguio if needed
    destino: apiService.destino,
    tipoViaje: apiService.tipoViaje,
    ocupacion: apiService.ocupacion,
    permanencia: apiService.permanencia,
    leadTime: apiService.leadTime as LeadTimeData,
    eta: apiService.eta,
    incidencias: apiService.incidencias,
    observaciones: apiService.observaciones,
    prioridad: apiService.prioridad,
  };
}

/**
 * Convert local SelectedService to API Service format
 */
function localServiceToApi(localService: SelectedService): Service {
  return {
    id: localService.id,
    cliente: localService.cliente,
    origen: localService.origen,
    destino: localService.destino,
    tipoViaje: localService.tipoViaje,
    ocupacion: localService.ocupacion,
    permanencia: localService.permanencia,
    leadTime: localService.leadTime,
    eta: localService.eta,
    incidencias: localService.incidencias,
    observaciones: localService.observaciones,
    prioridad: localService.prioridad,
  };
}
