import { describe, expect, it } from "vitest";
import {
  Auth0M2MCredentialSchema,
  buildAuth0TokenUrl,
  usagePath,
} from "./credential.types";

describe("usagePath", () => {
  it("sends channels to their Comunicaciones section and the rest to their pages", () => {
    expect(
      usagePath({
        id: "u",
        label: "x",
        kind: "CHANNEL",
        providerType: "WHATSAPP",
      })
    ).toBe("/users/settings/communications?section=channel:whatsapp");
    expect(
      usagePath({
        id: "u",
        label: "x",
        kind: "CHANNEL",
        providerType: "RESEND",
      })
    ).toBe("/users/settings/communications?section=channel:email");
    expect(
      usagePath({
        id: "u",
        label: "x",
        kind: "INTEGRATION",
        providerType: "CUSTOM_HTTP",
      })
    ).toBe("/users/settings/connections");
  });
});

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

describe("Auth0M2MCredentialSchema", () => {
  const form = {
    name: "Auth0",
    environment: "QA",
    domain: "tenant.auth0.com",
    clientId: "client-id",
    clientSecret: "secret",
    audience: "https://api.example.com",
    scope: "",
    tokenRequestFormat: "FORM" as const,
    tokenUrlOverride: "",
  };

  it("trims the domain returned to the form submission", () => {
    const parsed = Auth0M2MCredentialSchema.parse({
      ...form,
      domain: "  tenant.auth0.com  ",
    });

    expect(parsed.domain).toBe("tenant.auth0.com");
  });

  it("rejects a whitespace-only domain as missing", () => {
    const result = Auth0M2MCredentialSchema.safeParse({
      ...form,
      domain: "   ",
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues[0]?.message).toBe(
      "validation.auth0DomainRequired"
    );
  });
});
