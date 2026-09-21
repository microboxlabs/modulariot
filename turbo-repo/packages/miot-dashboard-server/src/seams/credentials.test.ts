import { describe, expect, it } from "vitest";
import {
  applyCredential,
  isCredentialsStore,
  previewOf,
  SECRET_PROPERTY_NAMES,
  type CredentialInput,
} from "./credentials";
import {
  createMemoryCredentialsStore,
  createMemoryCredentialsVault,
} from "../testing";

describe("applyCredential", () => {
  it("turns a bearer token into an Authorization header", () => {
    expect(applyCredential({ kind: "BEARER", token: "abc" })).toEqual({
      kind: "HTTP_AUTH",
      headers: { Authorization: "Bearer abc" },
      queryParams: {},
    });
  });

  it("base64-encodes basic auth, including non-ASCII", () => {
    const applied = applyCredential({
      kind: "BASIC",
      username: "ana",
      password: "contraseña",
    });
    if (applied.kind !== "HTTP_AUTH") throw new Error("expected HTTP_AUTH");

    // btoa alone throws above U+00FF, so this is the case that catches a
    // regression to it.
    const decoded = new TextDecoder().decode(
      Uint8Array.from(
        atob(applied.headers.Authorization!.slice("Basic ".length)),
        (c) => c.charCodeAt(0),
      ),
    );
    expect(decoded).toBe("ana:contraseña");
  });

  it("puts an API key where the credential says, header or query", () => {
    expect(
      applyCredential({ kind: "API_KEY_HEADER", header: "X-Key", value: "k" }),
    ).toEqual({
      kind: "HTTP_AUTH",
      headers: { "X-Key": "k" },
      queryParams: {},
    });

    expect(
      applyCredential({ kind: "API_KEY_QUERY", param: "apikey", value: "k" }),
    ).toEqual({ kind: "HTTP_AUTH", headers: {}, queryParams: { apikey: "k" } });
  });

  it("passes a service account through, because BigQuery signs its own", () => {
    const input: CredentialInput = {
      kind: "SERVICE_ACCOUNT",
      projectId: "p",
      clientEmail: "svc@example.iam.gserviceaccount.com",
      privateKey: "-----BEGIN PRIVATE KEY-----",
    };
    expect(applyCredential(input)).toEqual({ ...input });
  });

  it("resolves NONE to no auth at all", () => {
    expect(applyCredential({ kind: "NONE" })).toEqual({ kind: "NONE" });
  });
});

describe("previewOf", () => {
  it("shows the last four characters of a long secret, never more", () => {
    expect(previewOf({ kind: "BEARER", token: "abcdefghijklmnop" })).toBe(
      "…mnop",
    );
  });

  it("shows nothing when four characters would be most of the secret", () => {
    expect(previewOf({ kind: "BEARER", token: "short" })).toBeUndefined();
  });

  it("uses the non-secret half where a credential has one", () => {
    expect(
      previewOf({ kind: "BASIC", username: "ana", password: "whatever" }),
    ).toBe("ana");
  });
});

describe("isCredentialsStore", () => {
  it("is false for a read-only vault, so write routes stay unmounted", () => {
    expect(isCredentialsStore(createMemoryCredentialsVault())).toBe(false);
  });

  it("is true for a writable one", () => {
    expect(isCredentialsStore(createMemoryCredentialsStore())).toBe(true);
  });
});

describe("the memory store", () => {
  it("resolves what it was given as applied auth, not as the secret", async () => {
    const store = createMemoryCredentialsStore({
      t1: { pgrest: { kind: "BEARER", token: "0123456789abcdef" } },
    });

    await expect(store.resolve("t1", "pgrest")).resolves.toEqual({
      kind: "HTTP_AUTH",
      headers: { Authorization: "Bearer 0123456789abcdef" },
      queryParams: {},
    });
  });

  it("will not resolve another tenant's ref", async () => {
    const store = createMemoryCredentialsStore({
      t1: { pgrest: { kind: "BEARER", token: "0123456789abcdef" } },
    });

    await expect(store.resolve("t2", "pgrest")).resolves.toBeNull();
  });

  it("summarizes without the secret", async () => {
    const store = createMemoryCredentialsStore();
    const summary = await store.putCredential("t1", "pgrest", {
      kind: "BEARER",
      token: "0123456789abcdef",
    });

    expect(summary.kind).toBe("BEARER");
    expect(summary.preview).toBe("…cdef");
    expect(JSON.stringify(summary)).not.toContain("0123456789abcdef");
  });

  it("forgets a removed ref", async () => {
    const store = createMemoryCredentialsStore({
      t1: { pgrest: { kind: "BEARER", token: "0123456789abcdef" } },
    });

    await store.removeCredential("t1", "pgrest");

    await expect(store.resolve("t1", "pgrest")).resolves.toBeNull();
    await expect(store.listCredentials("t1")).resolves.toEqual([]);
  });
});

describe("SECRET_PROPERTY_NAMES", () => {
  /**
   * The gate is only as good as this list. Every secret-bearing property of
   * every CredentialInput variant has to be in it, so this enumerates them
   * from the type's own shape rather than trusting the constant.
   */
  it("covers every secret-bearing field of every input kind", () => {
    const samples: CredentialInput[] = [
      { kind: "NONE" },
      { kind: "BEARER", token: "t" },
      { kind: "API_KEY_HEADER", header: "X", value: "v" },
      { kind: "API_KEY_QUERY", param: "p", value: "v" },
      { kind: "BASIC", username: "u", password: "p" },
      {
        kind: "SERVICE_ACCOUNT",
        projectId: "p",
        clientEmail: "e",
        privateKey: "k",
      },
    ];

    // Non-secret by construction: a kind tag, a header or parameter name, a
    // username and a project are all safe to show.
    const notSecret = new Set([
      "kind",
      "header",
      "param",
      "username",
      "projectId",
      "clientEmail",
    ]);

    const secretFields = samples
      .flatMap((sample) => Object.keys(sample))
      .filter((key) => !notSecret.has(key));

    for (const field of secretFields) {
      expect(SECRET_PROPERTY_NAMES).toContain(field);
    }
  });

  it("covers the applied-auth carriers too", () => {
    expect(SECRET_PROPERTY_NAMES).toContain("headers");
    expect(SECRET_PROPERTY_NAMES).toContain("queryParams");
  });
});
