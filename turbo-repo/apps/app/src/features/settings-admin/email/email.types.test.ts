import { describe, expect, it } from "vitest";
import {
  EmailConnectionSchema,
  EmailEditSchema,
  emailCreate,
  emailToForm,
  emailUpdate,
  isSender,
  RESEND_BASE_URL,
} from "./email.types";
import type { IntegrationConnection } from "../channels/channel.types";

describe("isSender", () => {
  it("accepts a bare address or a named one", () => {
    expect(isSender("no-reply@example.test")).toBe(true);
    expect(isSender("Team <no-reply@example.test>")).toBe(true);
  });

  it("rejects anything without one @ and a dotted domain", () => {
    expect(isSender("Team")).toBe(false);
    expect(isSender("a@b")).toBe(false);
    expect(isSender("a@@b.test")).toBe(false);
    expect(isSender("Team <no reply@example.test>")).toBe(false);
  });
});

describe("email connection forms", () => {
  const form = {
    name: "Correo",
    from: " Team <no-reply@example.test> ",
    baseUrl: RESEND_BASE_URL,
    token: "re_123",
  };

  it("needs an API key to create, not to edit", () => {
    expect(
      EmailConnectionSchema.safeParse({ ...form, token: "" }).success
    ).toBe(false);
    expect(EmailEditSchema.safeParse({ ...form, token: "" }).success).toBe(
      true
    );
  });

  it("stores the key as the credential and the sender as metadata", () => {
    expect(emailCreate(form)).toEqual({
      name: "Correo",
      baseUrl: RESEND_BASE_URL,
      token: "re_123",
      credentialName: "Resend · Team <no-reply@example.test>",
      metadata: { from: "Team <no-reply@example.test>" },
    });
    expect(emailUpdate({ ...form, token: "" }).token).toBe("");
  });

  it("reads a stored connection back into the form without the key", () => {
    const connection = {
      name: "Correo",
      baseUrl: "",
      metadata: { from: "Team <no-reply@example.test>" },
    } as unknown as IntegrationConnection;
    expect(emailToForm(connection)).toEqual({
      name: "Correo",
      from: "Team <no-reply@example.test>",
      baseUrl: RESEND_BASE_URL,
      token: "",
    });
  });
});
