import { describe, it, expect } from "vitest";
import { shouldTestStoredCredential } from "./test-decision";
import type { DataSourceFormData } from "./types";

const tokenForm = (token?: string): DataSourceFormData => ({
  name: "ds",
  type: "POSTGREST",
  url: "https://db.example.com",
  authMethod: "TOKEN",
  token,
});

const oauthForm = (clientSecret?: string): DataSourceFormData => ({
  name: "ds",
  type: "POSTGREST",
  url: "https://db.example.com",
  authMethod: "OAUTH",
  clientId: "cid",
  clientSecret,
  tokenUrl: "https://auth.example.com/token",
});

describe("shouldTestStoredCredential", () => {
  it("is false when creating (not editing), even with a blank credential", () => {
    expect(shouldTestStoredCredential(false, tokenForm(""))).toBe(false);
    expect(shouldTestStoredCredential(false, oauthForm(""))).toBe(false);
  });

  it("is true when editing and the TOKEN credential is left blank (keep existing)", () => {
    expect(shouldTestStoredCredential(true, tokenForm(""))).toBe(true);
    expect(shouldTestStoredCredential(true, tokenForm(undefined))).toBe(true);
  });

  it("is false when editing but a new TOKEN credential was typed", () => {
    expect(shouldTestStoredCredential(true, tokenForm("new-token"))).toBe(false);
  });

  it("is true when editing and the OAuth client secret is left blank", () => {
    expect(shouldTestStoredCredential(true, oauthForm(""))).toBe(true);
  });

  it("is false when editing and a new OAuth client secret was typed", () => {
    expect(shouldTestStoredCredential(true, oauthForm("new-secret"))).toBe(false);
  });
});
