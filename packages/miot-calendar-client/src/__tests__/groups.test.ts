import { describe, it, expect } from "vitest";
import { createMiotCalendarClient } from "../index.js";
import type { CalendarGroupRequest, CalendarGroupResponse } from "../types.js";
import { createMockFetch } from "./test-utils.js";

const BASE_URL = "https://api.example.com";
const GROUPS_PATH = "/api/v1/miot-calendar/groups";

const sampleGroup: CalendarGroupResponse = {
  id: "grp-1",
  code: "warehouse-south",
  name: "Warehouse South",
  description: "Group for all calendars in Warehouse South",
  active: true,
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: "2025-01-01T00:00:00Z",
};

describe("groups", () => {
  describe("list", () => {
    it("sends GET to groups endpoint", async () => {
      const { fn, call } = createMockFetch([sampleGroup]);
      const client = createMiotCalendarClient({ baseUrl: BASE_URL, fetch: fn });

      await client.groups.list();

      expect(call.init.method).toBe("GET");
      expect(call.url).toBe(`${BASE_URL}${GROUPS_PATH}`);
    });

    it("passes active filter as query param", async () => {
      const { fn, call } = createMockFetch([sampleGroup]);
      const client = createMiotCalendarClient({ baseUrl: BASE_URL, fetch: fn });

      await client.groups.list({ active: true });

      const url = new URL(call.url);
      expect(url.searchParams.get("active")).toBe("true");
    });

    it("passes active: false as query param", async () => {
      const { fn, call } = createMockFetch([]);
      const client = createMiotCalendarClient({ baseUrl: BASE_URL, fetch: fn });

      await client.groups.list({ active: false });

      const url = new URL(call.url);
      expect(url.searchParams.get("active")).toBe("false");
    });

    it("returns group array", async () => {
      const { fn } = createMockFetch([sampleGroup]);
      const client = createMiotCalendarClient({ baseUrl: BASE_URL, fetch: fn });

      const result = await client.groups.list();

      expect(result).toEqual([sampleGroup]);
    });
  });

  describe("get", () => {
    it("sends GET to groups/:id", async () => {
      const { fn, call } = createMockFetch(sampleGroup);
      const client = createMiotCalendarClient({ baseUrl: BASE_URL, fetch: fn });

      await client.groups.get("grp-1");

      expect(call.init.method).toBe("GET");
      expect(call.url).toBe(`${BASE_URL}${GROUPS_PATH}/grp-1`);
    });

    it("returns the group", async () => {
      const { fn } = createMockFetch(sampleGroup);
      const client = createMiotCalendarClient({ baseUrl: BASE_URL, fetch: fn });

      const result = await client.groups.get("grp-1");

      expect(result).toEqual(sampleGroup);
    });
  });

  describe("create", () => {
    const groupRequest: CalendarGroupRequest = {
      code: "warehouse-south",
      name: "Warehouse South",
    };

    it("sends POST with body", async () => {
      const { fn, call } = createMockFetch(sampleGroup, 201);
      const client = createMiotCalendarClient({ baseUrl: BASE_URL, fetch: fn });

      await client.groups.create(groupRequest);

      expect(call.init.method).toBe("POST");
      expect(call.url).toBe(`${BASE_URL}${GROUPS_PATH}`);
      expect(call.init.body).toBe(JSON.stringify(groupRequest));
    });

    it("returns created group", async () => {
      const { fn } = createMockFetch(sampleGroup, 201);
      const client = createMiotCalendarClient({ baseUrl: BASE_URL, fetch: fn });

      const result = await client.groups.create(groupRequest);

      expect(result).toEqual(sampleGroup);
    });
  });

  describe("update", () => {
    const groupRequest: CalendarGroupRequest = {
      code: "warehouse-south",
      name: "Warehouse South Updated",
    };

    it("sends PUT to groups/:id with body", async () => {
      const { fn, call } = createMockFetch(sampleGroup);
      const client = createMiotCalendarClient({ baseUrl: BASE_URL, fetch: fn });

      await client.groups.update("grp-1", groupRequest);

      expect(call.init.method).toBe("PUT");
      expect(call.url).toBe(`${BASE_URL}${GROUPS_PATH}/grp-1`);
      expect(call.init.body).toBe(JSON.stringify(groupRequest));
    });

    it("returns updated group", async () => {
      const { fn } = createMockFetch(sampleGroup);
      const client = createMiotCalendarClient({ baseUrl: BASE_URL, fetch: fn });

      const result = await client.groups.update("grp-1", groupRequest);

      expect(result).toEqual(sampleGroup);
    });
  });

  describe("deactivate", () => {
    it("sends DELETE to groups/:id", async () => {
      const { fn, call } = createMockFetch(undefined, 204);
      const client = createMiotCalendarClient({ baseUrl: BASE_URL, fetch: fn });

      await client.groups.deactivate("grp-1");

      expect(call.init.method).toBe("DELETE");
      expect(call.url).toBe(`${BASE_URL}${GROUPS_PATH}/grp-1`);
    });

    it("returns undefined", async () => {
      const { fn } = createMockFetch(undefined, 204);
      const client = createMiotCalendarClient({ baseUrl: BASE_URL, fetch: fn });

      const result = await client.groups.deactivate("grp-1");

      expect(result).toBeUndefined();
    });
  });
});
