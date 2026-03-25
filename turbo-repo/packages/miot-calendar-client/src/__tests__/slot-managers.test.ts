import { describe, it, expect } from "vitest";
import { createMiotCalendarClient } from "../index.js";
import type {
  SlotManagerRequest,
  SlotManagerResponse,
  SlotManagerRunResponse,
} from "../types.js";
import { createMockFetch } from "./test-utils.js";

const BASE_URL = "https://api.example.com";
const SM_PATH = "/api/v1/miot-calendar/slot-managers";

const sampleManager: SlotManagerResponse = {
  id: "sm-1",
  calendarId: "cal-1",
  calendarCode: "CAL01",
  calendarName: "Test Calendar",
  active: true,
  daysInAdvance: 30,
  batchDays: 7,
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: "2025-01-01T00:00:00Z",
};

const sampleRun: SlotManagerRunResponse = {
  id: "run-1",
  managerId: "sm-1",
  triggeredBy: "API",
  startedAt: "2025-06-01T10:00:00Z",
  finishedAt: "2025-06-01T10:00:05Z",
  status: "SUCCESS",
  slotsCreated: 50,
  slotsSkipped: 3,
  generatedFrom: "2025-06-01",
  generatedThrough: "2025-06-30",
};

describe("slotManagers", () => {
  describe("list", () => {
    it("sends GET to slot-managers", async () => {
      const { fn, call } = createMockFetch([sampleManager]);
      const client = createMiotCalendarClient({ baseUrl: BASE_URL, fetch: fn });

      await client.slotManagers.list();

      expect(call.init.method).toBe("GET");
      expect(new URL(call.url).pathname).toBe(SM_PATH);
    });

    it("passes active filter", async () => {
      const { fn, call } = createMockFetch([sampleManager]);
      const client = createMiotCalendarClient({ baseUrl: BASE_URL, fetch: fn });

      await client.slotManagers.list({ active: true });

      const url = new URL(call.url);
      expect(url.searchParams.get("active")).toBe("true");
    });

    it("returns the list", async () => {
      const { fn } = createMockFetch([sampleManager]);
      const client = createMiotCalendarClient({ baseUrl: BASE_URL, fetch: fn });

      const result = await client.slotManagers.list();

      expect(result).toEqual([sampleManager]);
    });
  });

  describe("create", () => {
    const body: SlotManagerRequest = {
      calendarId: "cal-1",
      daysInAdvance: 14,
    };

    it("sends POST with body", async () => {
      const { fn, call } = createMockFetch(sampleManager, 201);
      const client = createMiotCalendarClient({ baseUrl: BASE_URL, fetch: fn });

      await client.slotManagers.create(body);

      expect(call.init.method).toBe("POST");
      expect(call.url).toBe(`${BASE_URL}${SM_PATH}`);
      expect(call.init.body).toBe(JSON.stringify(body));
    });

    it("returns the created manager", async () => {
      const { fn } = createMockFetch(sampleManager, 201);
      const client = createMiotCalendarClient({ baseUrl: BASE_URL, fetch: fn });

      const result = await client.slotManagers.create(body);

      expect(result).toEqual(sampleManager);
    });
  });

  describe("get", () => {
    it("sends GET to slot-managers/:id", async () => {
      const { fn, call } = createMockFetch(sampleManager);
      const client = createMiotCalendarClient({ baseUrl: BASE_URL, fetch: fn });

      await client.slotManagers.get("sm-1");

      expect(call.init.method).toBe("GET");
      expect(call.url).toBe(`${BASE_URL}${SM_PATH}/sm-1`);
    });

    it("returns the manager", async () => {
      const { fn } = createMockFetch(sampleManager);
      const client = createMiotCalendarClient({ baseUrl: BASE_URL, fetch: fn });

      const result = await client.slotManagers.get("sm-1");

      expect(result).toEqual(sampleManager);
    });
  });

  describe("update", () => {
    const body: SlotManagerRequest = {
      calendarId: "cal-1",
      daysInAdvance: 60,
      reprocessFrom: "2025-06-01",
      reprocessTo: "2025-06-30",
    };

    it("sends PUT to slot-managers/:id with body", async () => {
      const { fn, call } = createMockFetch(sampleManager);
      const client = createMiotCalendarClient({ baseUrl: BASE_URL, fetch: fn });

      await client.slotManagers.update("sm-1", body);

      expect(call.init.method).toBe("PUT");
      expect(call.url).toBe(`${BASE_URL}${SM_PATH}/sm-1`);
      expect(call.init.body).toBe(JSON.stringify(body));
    });

    it("returns the updated manager", async () => {
      const updated = { ...sampleManager, daysInAdvance: 60 };
      const { fn } = createMockFetch(updated);
      const client = createMiotCalendarClient({ baseUrl: BASE_URL, fetch: fn });

      const result = await client.slotManagers.update("sm-1", body);

      expect(result.daysInAdvance).toBe(60);
    });
  });

  describe("deactivate", () => {
    it("sends DELETE to slot-managers/:id", async () => {
      const { fn, call } = createMockFetch(undefined, 204);
      const client = createMiotCalendarClient({ baseUrl: BASE_URL, fetch: fn });

      await client.slotManagers.deactivate("sm-1");

      expect(call.init.method).toBe("DELETE");
      expect(call.url).toBe(`${BASE_URL}${SM_PATH}/sm-1`);
    });
  });

  describe("runAll", () => {
    it("sends POST to slot-managers/run", async () => {
      const { fn, call } = createMockFetch([sampleRun]);
      const client = createMiotCalendarClient({ baseUrl: BASE_URL, fetch: fn });

      await client.slotManagers.runAll();

      expect(call.init.method).toBe("POST");
      expect(call.url).toBe(`${BASE_URL}${SM_PATH}/run`);
    });

    it("returns run results", async () => {
      const { fn } = createMockFetch([sampleRun]);
      const client = createMiotCalendarClient({ baseUrl: BASE_URL, fetch: fn });

      const result = await client.slotManagers.runAll();

      expect(result).toEqual([sampleRun]);
    });
  });

  describe("run", () => {
    it("sends POST to slot-managers/:id/run", async () => {
      const { fn, call } = createMockFetch(sampleRun);
      const client = createMiotCalendarClient({ baseUrl: BASE_URL, fetch: fn });

      await client.slotManagers.run("sm-1");

      expect(call.init.method).toBe("POST");
      expect(call.url).toBe(`${BASE_URL}${SM_PATH}/sm-1/run`);
    });

    it("returns the run record", async () => {
      const { fn } = createMockFetch(sampleRun);
      const client = createMiotCalendarClient({ baseUrl: BASE_URL, fetch: fn });

      const result = await client.slotManagers.run("sm-1");

      expect(result).toEqual(sampleRun);
    });
  });

  describe("listAllRuns", () => {
    it("sends GET to slot-managers/runs", async () => {
      const { fn, call } = createMockFetch([sampleRun]);
      const client = createMiotCalendarClient({ baseUrl: BASE_URL, fetch: fn });

      await client.slotManagers.listAllRuns();

      expect(call.init.method).toBe("GET");
      expect(new URL(call.url).pathname).toBe(`${SM_PATH}/runs`);
    });

    it("passes limit param", async () => {
      const { fn, call } = createMockFetch([sampleRun]);
      const client = createMiotCalendarClient({ baseUrl: BASE_URL, fetch: fn });

      await client.slotManagers.listAllRuns({ limit: 10 });

      const url = new URL(call.url);
      expect(url.searchParams.get("limit")).toBe("10");
    });

    it("returns run records", async () => {
      const { fn } = createMockFetch([sampleRun]);
      const client = createMiotCalendarClient({ baseUrl: BASE_URL, fetch: fn });

      const result = await client.slotManagers.listAllRuns();

      expect(result).toEqual([sampleRun]);
    });
  });

  describe("listRuns", () => {
    it("sends GET to slot-managers/:id/runs", async () => {
      const { fn, call } = createMockFetch([sampleRun]);
      const client = createMiotCalendarClient({ baseUrl: BASE_URL, fetch: fn });

      await client.slotManagers.listRuns("sm-1");

      expect(call.init.method).toBe("GET");
      expect(new URL(call.url).pathname).toBe(`${SM_PATH}/sm-1/runs`);
    });

    it("passes limit param", async () => {
      const { fn, call } = createMockFetch([sampleRun]);
      const client = createMiotCalendarClient({ baseUrl: BASE_URL, fetch: fn });

      await client.slotManagers.listRuns("sm-1", { limit: 5 });

      const url = new URL(call.url);
      expect(url.searchParams.get("limit")).toBe("5");
    });

    it("returns run records", async () => {
      const { fn } = createMockFetch([sampleRun]);
      const client = createMiotCalendarClient({ baseUrl: BASE_URL, fetch: fn });

      const result = await client.slotManagers.listRuns("sm-1");

      expect(result).toEqual([sampleRun]);
    });
  });
});
