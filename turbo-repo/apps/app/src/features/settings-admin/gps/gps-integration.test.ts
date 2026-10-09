import { describe, expect, it } from "vitest";
import {
  KEY_PLACEHOLDER,
  SECRET_PLACEHOLDER,
  credentialsJson,
  tokenCurl,
  trackCurl,
  type GpsIntegration,
} from "./gps-integration";

const integration: GpsIntegration = {
  clientId: "client-1",
  audience: "https://gps.example.test/track",
  tokenUrl: "https://auth.example.test/oauth/token",
  trackUrl: "https://gps.example.test/track",
  keyTrackUrl: "https://app.example.test/api/v1/asset/track",
  scopes: ["asset:track:write"],
  secretAvailable: true,
};

describe("credentialsJson", () => {
  it("is the token request body, with a placeholder until the secret is shown", () => {
    expect(JSON.parse(credentialsJson(integration, null))).toEqual({
      client_id: "client-1",
      client_secret: SECRET_PLACEHOLDER,
      audience: "https://gps.example.test/track",
      grant_type: "client_credentials",
    });
    expect(
      JSON.parse(credentialsJson(integration, "s3cret")).client_secret
    ).toBe("s3cret");
  });
});

describe("tokenCurl", () => {
  it("posts the credentials to the token endpoint", () => {
    const curl = tokenCurl(integration, "s3cret");
    expect(curl).toContain("--url https://auth.example.test/oauth/token");
    const body = curl.slice(curl.indexOf("'{") + 1, curl.lastIndexOf("}'") + 1);
    expect(JSON.parse(body).client_secret).toBe("s3cret");
  });
});

describe("trackCurl", () => {
  it("sends a valid position with the required headers", () => {
    const curl = trackCurl(integration.keyTrackUrl, KEY_PLACEHOLDER);
    expect(curl).toContain(`Authorization: Bearer ${KEY_PLACEHOLDER}`);
    expect(curl).toContain("X-Request-Id: ");
    expect(curl).toContain("X-Request-Timestamp: ");
    const body = curl.slice(curl.indexOf("'{") + 1, curl.lastIndexOf("}'") + 1);
    expect(JSON.parse(body)).toMatchObject({
      asset_id: "ABCD12",
      gps: { latitude: -33.4489, longitude: -70.6693 },
    });
  });
});
