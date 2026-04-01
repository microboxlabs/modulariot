import { describe, it, expect } from "vitest";
import { createMiotResourceClient } from "../index.js";
import type { Carrier, EntityEvent, Trailer, Truck, Vehicle } from "../types.js";
import { createMockFetch } from "./test-utils.js";

const BASE_URL = "https://api.example.com";
const FLEET = "/api/v1/fleet";

const tenant = { id: 1, code: "t-1", name: "Tenant 1", active: true };

const sampleTruck: Truck = {
  id: 1, tenant, clientId: "c-1", entityId: "uuid-truck-1",
  externalId: "ext-1", status: "ACTIVE", alfrescoNodeId: "node-1",
  active: true, createdAt: "2025-01-01T00:00:00Z", updatedAt: "2025-01-01T00:00:00Z",
  licensePlate: "ABC123", vin: "VIN123", brand: "Volvo", model: "FH16",
  year: 2022, maxWeight: 25000, volume: 100, truckType: "RIGID",
};

const sampleTrailer: Trailer = {
  id: 2, tenant, clientId: "c-1", entityId: "uuid-trailer-1",
  externalId: "ext-2", status: "ACTIVE", alfrescoNodeId: "node-2",
  active: true, createdAt: "2025-01-01T00:00:00Z", updatedAt: "2025-01-01T00:00:00Z",
  licensePlate: "XYZ456", trailerType: "FLATBED", maxWeight: 20000, axleCount: 3,
};

const sampleCarrier: Carrier = {
  id: 3, tenant, clientId: "c-1", entityId: "uuid-carrier-1",
  externalId: "ext-3", status: "ACTIVE", alfrescoNodeId: "node-3",
  active: true, createdAt: "2025-01-01T00:00:00Z", updatedAt: "2025-01-01T00:00:00Z",
  name: "Acme Transport", rut: "76543210-1", transportLicense: "LIC-001",
  transportLicenseExpires: "2026-12-31T00:00:00Z",
};

const sampleVehicle: Vehicle = {
  id: 4, tenant, plate: "DEF789", vin: "VIN456",
  brand: "Mercedes", model: "Actros", year: 2021, active: true,
};

const sampleEvent: EntityEvent = {
  id: 10, clientId: "c-1", entityType: "TRUCK", entityId: "uuid-truck-1",
  eventType: "STATUS_CHANGED", eventSource: "api", actor: "user-1",
  payload: "{}", metadata: "{}", createdAt: "2025-01-01T00:00:00Z",
};

describe("fleet", () => {
  describe("trucks", () => {
    it("listTrucks sends GET to /fleet/trucks", async () => {
      const { fn, call } = createMockFetch([sampleTruck]);
      const client = createMiotResourceClient({ baseUrl: BASE_URL, fetch: fn });

      await client.fleet.listTrucks();

      expect(call.init.method).toBe("GET");
      expect(call.url).toBe(`${BASE_URL}${FLEET}/trucks`);
    });

    it("listTrucks passes pagination params", async () => {
      const { fn, call } = createMockFetch([]);
      const client = createMiotResourceClient({ baseUrl: BASE_URL, fetch: fn });

      await client.fleet.listTrucks({ page: 2, size: 10 });

      const url = new URL(call.url);
      expect(url.searchParams.get("page")).toBe("2");
      expect(url.searchParams.get("size")).toBe("10");
    });

    it("getTruck sends GET to /fleet/trucks/:id", async () => {
      const { fn, call } = createMockFetch(sampleTruck);
      const client = createMiotResourceClient({ baseUrl: BASE_URL, fetch: fn });

      const result = await client.fleet.getTruck(1);

      expect(call.init.method).toBe("GET");
      expect(call.url).toBe(`${BASE_URL}${FLEET}/trucks/1`);
      expect(result).toEqual(sampleTruck);
    });

    it("createTruck sends POST with body", async () => {
      const { fn, call } = createMockFetch(sampleTruck);
      const client = createMiotResourceClient({ baseUrl: BASE_URL, fetch: fn });
      const body = { licensePlate: "ABC123", brand: "Volvo" };

      await client.fleet.createTruck(body);

      expect(call.init.method).toBe("POST");
      expect(call.url).toBe(`${BASE_URL}${FLEET}/trucks`);
      expect(call.init.body).toBe(JSON.stringify(body));
    });

    it("changeTruckStatus sends PATCH to /fleet/trucks/:id/status", async () => {
      const { fn, call } = createMockFetch(sampleTruck);
      const client = createMiotResourceClient({ baseUrl: BASE_URL, fetch: fn });

      await client.fleet.changeTruckStatus(1, { status: "INACTIVE", reason: "Maintenance" });

      expect(call.init.method).toBe("PATCH");
      expect(call.url).toBe(`${BASE_URL}${FLEET}/trucks/1/status`);
    });

    it("listTruckEvents sends GET to /fleet/trucks/:id/events", async () => {
      const { fn, call } = createMockFetch([sampleEvent]);
      const client = createMiotResourceClient({ baseUrl: BASE_URL, fetch: fn });

      const result = await client.fleet.listTruckEvents(1, { limit: 20 });

      expect(call.init.method).toBe("GET");
      expect(call.url).toContain(`${FLEET}/trucks/1/events`);
      expect(new URL(call.url).searchParams.get("limit")).toBe("20");
      expect(result).toEqual([sampleEvent]);
    });
  });

  describe("trailers", () => {
    it("listTrailers sends GET to /fleet/trailers", async () => {
      const { fn, call } = createMockFetch([sampleTrailer]);
      const client = createMiotResourceClient({ baseUrl: BASE_URL, fetch: fn });

      const result = await client.fleet.listTrailers();

      expect(call.init.method).toBe("GET");
      expect(call.url).toBe(`${BASE_URL}${FLEET}/trailers`);
      expect(result).toEqual([sampleTrailer]);
    });

    it("getTrailer sends GET to /fleet/trailers/:id", async () => {
      const { fn, call } = createMockFetch(sampleTrailer);
      const client = createMiotResourceClient({ baseUrl: BASE_URL, fetch: fn });

      const result = await client.fleet.getTrailer(2);

      expect(call.url).toBe(`${BASE_URL}${FLEET}/trailers/2`);
      expect(result).toEqual(sampleTrailer);
    });

    it("createTrailer sends POST with body", async () => {
      const { fn, call } = createMockFetch(sampleTrailer);
      const client = createMiotResourceClient({ baseUrl: BASE_URL, fetch: fn });
      const body = { licensePlate: "XYZ456", trailerType: "FLATBED" };

      await client.fleet.createTrailer(body);

      expect(call.init.method).toBe("POST");
      expect(call.init.body).toBe(JSON.stringify(body));
    });

    it("changeTrailerStatus sends PATCH to /fleet/trailers/:id/status", async () => {
      const { fn, call } = createMockFetch(sampleTrailer);
      const client = createMiotResourceClient({ baseUrl: BASE_URL, fetch: fn });

      await client.fleet.changeTrailerStatus(2, { status: "INACTIVE" });

      expect(call.init.method).toBe("PATCH");
      expect(call.url).toBe(`${BASE_URL}${FLEET}/trailers/2/status`);
    });

    it("listTrailerEvents sends GET to /fleet/trailers/:id/events", async () => {
      const { fn, call } = createMockFetch([sampleEvent]);
      const client = createMiotResourceClient({ baseUrl: BASE_URL, fetch: fn });

      await client.fleet.listTrailerEvents(2);

      expect(call.url).toContain(`${FLEET}/trailers/2/events`);
    });
  });

  describe("carriers", () => {
    it("listCarriers sends GET to /fleet/carriers", async () => {
      const { fn, call } = createMockFetch([sampleCarrier]);
      const client = createMiotResourceClient({ baseUrl: BASE_URL, fetch: fn });

      const result = await client.fleet.listCarriers();

      expect(call.init.method).toBe("GET");
      expect(call.url).toBe(`${BASE_URL}${FLEET}/carriers`);
      expect(result).toEqual([sampleCarrier]);
    });

    it("getCarrier sends GET to /fleet/carriers/:id", async () => {
      const { fn, call } = createMockFetch(sampleCarrier);
      const client = createMiotResourceClient({ baseUrl: BASE_URL, fetch: fn });

      const result = await client.fleet.getCarrier(3);

      expect(call.url).toBe(`${BASE_URL}${FLEET}/carriers/3`);
      expect(result).toEqual(sampleCarrier);
    });

    it("createCarrier sends POST with body", async () => {
      const { fn, call } = createMockFetch(sampleCarrier);
      const client = createMiotResourceClient({ baseUrl: BASE_URL, fetch: fn });
      const body = { name: "Acme Transport", rut: "76543210-1" };

      await client.fleet.createCarrier(body);

      expect(call.init.method).toBe("POST");
      expect(call.init.body).toBe(JSON.stringify(body));
    });

    it("changeCarrierStatus sends PATCH to /fleet/carriers/:id/status", async () => {
      const { fn, call } = createMockFetch(sampleCarrier);
      const client = createMiotResourceClient({ baseUrl: BASE_URL, fetch: fn });

      await client.fleet.changeCarrierStatus(3, { status: "SUSPENDED" });

      expect(call.init.method).toBe("PATCH");
      expect(call.url).toBe(`${BASE_URL}${FLEET}/carriers/3/status`);
    });

    it("listCarrierEvents sends GET to /fleet/carriers/:id/events", async () => {
      const { fn, call } = createMockFetch([sampleEvent]);
      const client = createMiotResourceClient({ baseUrl: BASE_URL, fetch: fn });

      await client.fleet.listCarrierEvents(3, { limit: 5 });

      expect(call.url).toContain(`${FLEET}/carriers/3/events`);
      expect(new URL(call.url).searchParams.get("limit")).toBe("5");
    });
  });

  describe("vehicles", () => {
    it("listVehicles sends GET to /fleet/vehicles", async () => {
      const { fn, call } = createMockFetch([sampleVehicle]);
      const client = createMiotResourceClient({ baseUrl: BASE_URL, fetch: fn });

      const result = await client.fleet.listVehicles();

      expect(call.init.method).toBe("GET");
      expect(call.url).toBe(`${BASE_URL}${FLEET}/vehicles`);
      expect(result).toEqual([sampleVehicle]);
    });
  });
});
