import { describe, expect, it } from "vitest";
import {
  EmailConnectionSchema,
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
    expect(isSender("not-an-address@")).toBe(false);
    expect(isSender("Team<no-reply@example.test")).toBe(false);
    expect(isSender("Team <a@b.test> x")).toBe(false);
  });
});

describe("email connection form", () => {
  const form = {
    name: "Correo",
    from: " Team <no-reply@example.test> ",
    credentialId: "cred-1",
  };

  it("needs a Resend credential", () => {
    expect(EmailConnectionSchema.safeParse(form).success).toBe(true);
    expect(
      EmailConnectionSchema.safeParse({ ...form, credentialId: "" }).success
    ).toBe(false);
  });

  it("links the chosen credential and keeps the sender as metadata", () => {
    expect(emailCreate(form)).toEqual({
      name: "Correo",
      baseUrl: RESEND_BASE_URL,
      credentialProfileId: "cred-1",
      metadata: { from: "Team <no-reply@example.test>" },
    });
  });

  it("sends the credential only when it changed", () => {
    expect(emailUpdate(form, "cred-1").credentialProfileId).toBeUndefined();
    expect(emailUpdate(form, "cred-0").credentialProfileId).toBe("cred-1");
  });

  it("reads a stored connection back into the form", () => {
    const connection = {
      name: "Correo",
      baseUrl: "",
      credentialProfileId: "cred-1",
      metadata: { from: "Team <no-reply@example.test>" },
    } as unknown as IntegrationConnection;
    expect(emailToForm(connection)).toEqual({
      name: "Correo",
      from: "Team <no-reply@example.test>",
      credentialId: "cred-1",
    });
  });
});
