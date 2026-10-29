import { describe, expect, it } from "vitest";
import {
  geocodingDraftFrom,
  toGeocodingRequest,
} from "./platform-geocoding-form";

const draft = {
  provider: "mapbox" as const,
  token: " pk.secret ",
  permanent: true,
  cost: "0.0075",
};

describe("platform geocoding form", () => {
  it("sends the provider, token, permanent mode and our cost", () => {
    expect(toGeocodingRequest(draft, false)).toEqual({
      ok: true,
      value: {
        provider: "mapbox",
        token: "pk.secret",
        permanent: true,
        costPerRequestUsd: 0.0075,
      },
    });
  });

  it("needs a token only the first time", () => {
    expect(toGeocodingRequest({ ...draft, token: "" }, false)).toEqual({
      ok: false,
      error: "tokenRequired",
    });
    const kept = toGeocodingRequest({ ...draft, token: "" }, true);
    expect(kept.ok && kept.value.token).toBe("");
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

  it("starts from what is stored, without the token", () => {
    expect(
      geocodingDraftFrom({
        configured: true,
        connectionId: "c1",
        provider: "google",
        permanent: null,
        costPerRequestUsd: 0.005,
        tokenPreview: "AIza…",
      })
    ).toEqual({
      provider: "google",
      token: "",
      permanent: true,
      cost: "0.005",
    });
  });
});
