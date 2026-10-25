import { describe, expect, it } from "vitest";
import { platformScopeLanding } from "./platform-scope";

describe("platformScopeLanding", () => {
  it("keeps a page the platform scope has", () => {
    expect(
      platformScopeLanding("/app/es/users/settings/communications")
    ).toBeNull();
    expect(platformScopeLanding("/app/es/integrations/jobs")).toBeNull();
  });

  it("leaves an organization's record for the page that lists them", () => {
    expect(
      platformScopeLanding("/app/es/users/settings/symptoms/0000-org-id")
    ).toBe("/app/es/users/settings/symptoms");
    expect(platformScopeLanding("/app/en/users/settings/credentials/abc")).toBe(
      "/app/en/users/settings/credentials"
    );
  });

  it("sends an organization-only page to Plataforma in the same language", () => {
    expect(platformScopeLanding("/app/es/fleet")).toBe(
      "/app/es/users/settings/platform"
    );
    expect(platformScopeLanding("/app/en/users/settings/team")).toBe(
      "/app/en/users/settings/platform"
    );
  });

  it("does not take a prefix of a page name for the page", () => {
    expect(platformScopeLanding("/app/es/users/settings/platform-x")).toBe(
      "/app/es/users/settings/platform"
    );
  });
});
