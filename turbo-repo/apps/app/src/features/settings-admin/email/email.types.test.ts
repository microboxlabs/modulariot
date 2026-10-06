import { describe, expect, it } from "vitest";
import {
  EmailConnectionSchema,
  EmailEditSchema,
  emailCreate,
  emailToForm,
  emailUpdate,
  isSender,
  NEW_KEY,
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
    credentialId: NEW_KEY,
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

  it("saves a new key as a Resend credential, or links a stored one", () => {
    expect(emailCreate(form)).toEqual({
      name: "Correo",
      baseUrl: RESEND_BASE_URL,
      token: "re_123",
      credentialName: "Resend · Team <no-reply@example.test>",
      credentialPublicConfig: { provider: "resend" },
      metadata: { from: "Team <no-reply@example.test>" },
    });
    expect(
      emailCreate({ ...form, credentialId: "cred-1", token: "" })
        .credentialProfileId
    ).toBe("cred-1");
    expect(
      EmailConnectionSchema.safeParse({
        ...form,
        credentialId: "cred-1",
        token: "",
      }).success
    ).toBe(true);
  });

  it("swaps the credential, or rotates the key of the current one", () => {
    const swap = emailUpdate({ ...form, credentialId: "cred-2" }, "cred-1");
    expect(swap.credentialProfileId).toBe("cred-2");
    expect(swap.token).toBeUndefined();
    const rotate = emailUpdate({ ...form, credentialId: "cred-1" }, "cred-1");
    expect(rotate.credentialProfileId).toBeUndefined();
    expect(rotate.token).toBe("re_123");
  });

  it("reads a stored connection back into the form without the key", () => {
    const connection = {
      name: "Correo",
      baseUrl: "",
      credentialProfileId: "cred-1",
      metadata: { from: "Team <no-reply@example.test>" },
    } as unknown as IntegrationConnection;
    expect(emailToForm(connection)).toEqual({
      name: "Correo",
      from: "Team <no-reply@example.test>",
      baseUrl: RESEND_BASE_URL,
      credentialId: "cred-1",
      token: "",
    });
  });
});
