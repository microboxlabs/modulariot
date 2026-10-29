import { describe, expect, it } from "vitest";
import type { IntegrationConnection } from "@/features/settings-admin/channels/channel.types";
import {
  GEOCODING_DEFAULTS,
  GeocodingConnectionSchema,
  geocodingCreate,
  geocodingToForm,
  geocodingUpdate,
} from "./geocoding-connection";

const connection: IntegrationConnection = {
  id: "c-1",
  tenantCode: "sample",
  name: "Geocoding",
  providerType: "GEOCODING",
  baseUrl: "https://maps.googleapis.com",
  credentialProfileId: "cred-1",
  status: "DRAFT",
  lastTestedAt: null,
  lastTestResult: null,
  metadata: { provider: "google", costPerRequestUsd: "0.005" },
};

describe("geocoding connection form", () => {
  it("creates a Mapbox connection on the provider's host with a bearer token", () => {
    const create = geocodingCreate({
      ...GEOCODING_DEFAULTS,
      name: " Mapbox ",
      token: " pk.test ",
      cost: "0.0075",
    });
    expect(create).toMatchObject({
      name: "Mapbox",
      baseUrl: "https://api.mapbox.com",
      token: "pk.test",
      metadata: {
        provider: "mapbox",
        permanent: true,
        costPerRequestUsd: "0.0075",
      },
    });
  });

  it("sends no permanent flag for Google and no cost when empty", () => {
    const create = geocodingCreate({
      ...GEOCODING_DEFAULTS,
      name: "Google",
      provider: "google",
      token: "key",
    });
    expect(create.baseUrl).toBe("https://maps.googleapis.com");
    expect(create.metadata).toEqual({ provider: "google" });
  });

  it("keeps the stored token when the field is left empty", () => {
    expect(geocodingUpdate(geocodingToForm(connection)).token).toBeUndefined();
  });

  it("reads the provider, the price and the permanent mode back", () => {
    expect(geocodingToForm(connection)).toEqual({
      name: "Geocoding",
      provider: "google",
      token: "",
      permanent: true,
      cost: "0.005",
    });
    expect(
      geocodingToForm({ ...connection, metadata: { permanent: false } })
    ).toMatchObject({ provider: "mapbox", permanent: false });
  });

  it("refuses a price that is not a number", () => {
    const parsed = GeocodingConnectionSchema.safeParse({
      ...GEOCODING_DEFAULTS,
      name: "x",
      cost: "five cents",
    });
    expect(parsed.success).toBe(false);
  });
});
