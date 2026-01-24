/**
 * Slot (DÓNDE): Represents a time slot in the calendar
 */
export interface Slot {
  date: Date; // Fecha
  hour: number; // 0-23
  minutes: number; // 0 o 30
}

/**
 * Lead time data for OC lines compliance tracking
 */
export interface ServiceLeadTime {
  total_lineasoc_cumplen: number;
  total_lineasoc_incumplen: number;
  lineasoc_pctn_cumplimiento: number; // 0-100
}

/**
 * Service (QUÉ): Represents a service that can be planned
 */
export interface Service {
  id: string;
  cliente: string;
  origen: string;
  destino: string;
  tipoViaje: "Sider" | "Doble Sider" | "Rampla";
  ocupacion: number; // 0-100%
  permanencia: string; // e.g. "24h"
  leadTime: ServiceLeadTime;
  eta: string; // ISO datetime string
  incidencias: string[];
  observaciones: string;
  prioridad: number;
}

/**
 * PlannedService (Asignación de Servicio): Unites a service with a specific calendar slot
 */
export interface PlannedService {
  id?: string; // Optional ID for backend persistence
  service: Service;
  slot: Slot;
}

/**
 * Request/Response types for API operations
 */
export interface CreatePlannedServiceRequest {
  service: Service;
  slot: Slot;
}

export interface UpdatePlannedServiceRequest {
  id: string;
  service?: Partial<Service>;
  slot?: Partial<Slot>;
}

export interface PlannedServiceResponse {
  id: string;
  service: Service;
  slot: {
    date: string; // ISO date string
    hour: number;
    minutes: number;
  };
}

export interface PlannedServiceListResponse {
  data: PlannedServiceResponse[];
  total?: number;
}
