import { afterEach, describe, expect, it } from "vitest";
import { GET } from "./route";

const ENV_KEYS = [
  "ECM_PUBLIC_URL",
  "MAPBOX_API_KEY",
  "MAP_DEFAULT_TRIP_FILTER",
  "TASK_DRIVEN_ORIGINS",
] as const;

describe("runtime config route", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("exposes the Mapbox token from the server runtime environment", async () => {
    process.env[ENV_KEYS[0]] = "https://coordinador.example.com";
    process.env[ENV_KEYS[1]] = "pk.runtime-mapbox-token";
    process.env[ENV_KEYS[2]] = "true";
    process.env[ENV_KEYS[3]] = "ANTOFAGASTA";

    const response = GET();
    const data = await response.json();

    expect(data).toEqual({
      ECM_PUBLIC_URL: "https://coordinador.example.com",
      MAPBOX_API_KEY: "pk.runtime-mapbox-token",
      MAP_DEFAULT_TRIP_FILTER: "true",
      TASK_DRIVEN_ORIGINS: "ANTOFAGASTA",
    });
  });

  it("keeps the public runtime config shape stable when env vars are unset", async () => {
    for (const key of ENV_KEYS) {
      delete process.env[key];
    }

    const response = GET();
    const data = await response.json();

    expect(Object.keys(data).sort()).toEqual([...ENV_KEYS].sort());
    expect(data.MAPBOX_API_KEY).toBe("");
  });
});
