import { describe, expect, it } from "vitest";
import {
  geocodingDraftFrom,
  toGeocodingRequest,
} from "./platform-geocoding-form";

const draft = {
  provider: "mapbox" as const,
  credentialId: " cred-1 ",
  permanent: true,
  cost: "0.0075",
};

describe("platform geocoding form", () => {
  it("sends the provider, credential, permanent mode and our cost", () => {
    expect(toGeocodingRequest(draft, false)).toEqual({
      ok: true,
      value: {
        provider: "mapbox",
        credentialProfileId: "cred-1",
        permanent: true,
        costPerRequestUsd: 0.0075,
      },
    });
  });

  it("needs a credential the first time and keeps the linked one later", () => {
    expect(toGeocodingRequest({ ...draft, credentialId: "" }, false)).toEqual({
      ok: false,
      error: "credentialRequired",
    });
    const kept = toGeocodingRequest({ ...draft, credentialId: "" }, true);
    expect(kept.ok && kept.value.credentialProfileId).toBeNull();
  });

  it("refuses a cost that is not a number and sends none when empty", () => {
    expect(toGeocodingRequest({ ...draft, cost: "abc" }, true)).toEqual({
      ok: false,
      error: "costInvalid",
    });
    const none = toGeocodingRequest({ ...draft, cost: " " }, true);
    expect(none.ok && none.value.costPerRequestUsd).toBeNull();
  });

  it("sends permanent only for Mapbox", () => {
    const google = toGeocodingRequest({ ...draft, provider: "google" }, true);
    expect(google.ok && google.value.permanent).toBe(false);
  });

  it("starts from what is stored, with its credential", () => {
    expect(
      geocodingDraftFrom({
        configured: true,
        connectionId: "c1",
        provider: "google",
        permanent: null,
        costPerRequestUsd: 0.005,
        credentialProfileId: "cred-1",
        credentialName: "Google Maps",
      })
    ).toEqual({
      provider: "google",
      credentialId: "cred-1",
      permanent: true,
      cost: "0.005",
    });
  });
});
