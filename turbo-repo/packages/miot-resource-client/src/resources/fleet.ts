import type { Fetcher } from "../client.js";
import type {
  Carrier,
  CreateCarrierRequest,
  CreateTrailerRequest,
  CreateTruckRequest,
  EntityEvent,
  PageParams,
  StatusChangeRequest,
  Trailer,
  Truck,
  TruckQueryParams,
} from "../types.js";

export function createFleetApi(fetcher: Fetcher, organizationId: string) {
  const BASE = `/api/v1/orgs/${organizationId}/fleet`;

  return {
    // --- Trucks ---

    listTrucks(params?: TruckQueryParams): Promise<Truck[]> {
      return fetcher("GET", `${BASE}/trucks`, { query: params });
    },

    getTruck(id: number, params?: Omit<TruckQueryParams, "page" | "size">): Promise<Truck> {
      return fetcher("GET", `${BASE}/trucks/${id}`, { query: params });
    },

    createTruck(body: CreateTruckRequest): Promise<Truck> {
      return fetcher("POST", `${BASE}/trucks`, { body });
    },

    changeTruckStatus(id: number, body: StatusChangeRequest): Promise<Truck> {
      return fetcher("PATCH", `${BASE}/trucks/${id}/status`, { body });
    },

    listTruckEvents(id: number, params?: { limit?: number }): Promise<EntityEvent[]> {
      return fetcher("GET", `${BASE}/trucks/${id}/events`, { query: params });
    },

    // --- Trailers ---

    listTrailers(params?: PageParams): Promise<Trailer[]> {
      return fetcher("GET", `${BASE}/trailers`, { query: params });
    },

    getTrailer(id: number): Promise<Trailer> {
      return fetcher("GET", `${BASE}/trailers/${id}`);
    },

    createTrailer(body: CreateTrailerRequest): Promise<Trailer> {
      return fetcher("POST", `${BASE}/trailers`, { body });
    },

    changeTrailerStatus(id: number, body: StatusChangeRequest): Promise<Trailer> {
      return fetcher("PATCH", `${BASE}/trailers/${id}/status`, { body });
    },

    listTrailerEvents(id: number, params?: { limit?: number }): Promise<EntityEvent[]> {
      return fetcher("GET", `${BASE}/trailers/${id}/events`, { query: params });
    },

    // --- Carriers ---

    listCarriers(params?: PageParams): Promise<Carrier[]> {
      return fetcher("GET", `${BASE}/carriers`, { query: params });
    },

    getCarrier(id: number): Promise<Carrier> {
      return fetcher("GET", `${BASE}/carriers/${id}`);
    },

    createCarrier(body: CreateCarrierRequest): Promise<Carrier> {
      return fetcher("POST", `${BASE}/carriers`, { body });
    },

    changeCarrierStatus(id: number, body: StatusChangeRequest): Promise<Carrier> {
      return fetcher("PATCH", `${BASE}/carriers/${id}/status`, { body });
    },

    listCarrierEvents(id: number, params?: { limit?: number }): Promise<EntityEvent[]> {
      return fetcher("GET", `${BASE}/carriers/${id}/events`, { query: params });
    },
  };
}
