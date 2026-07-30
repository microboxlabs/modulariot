import { describe, expect, it } from "vitest";
import { buildAuth0TokenUrl } from "./credential.types";

describe("buildAuth0TokenUrl", () => {
  it("normalizes the scheme and trailing slashes", () => {
    expect(buildAuth0TokenUrl(" HTTPS://tenant.auth0.com/// ")).toBe(
      "https://tenant.auth0.com/oauth/token"
    );
  });

  it("keeps a domain that does not need normalization", () => {
    expect(buildAuth0TokenUrl("tenant.auth0.com")).toBe(
      "https://tenant.auth0.com/oauth/token"
    );
  });

  it("returns the placeholder endpoint for an empty domain", () => {
    expect(buildAuth0TokenUrl(" /// ")).toBe(
      "https://{your-tenant}.auth0.com/oauth/token"
    );
  });
});
