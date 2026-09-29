import { describe, expect, it } from "vitest";
import {
  applyCredential,
  isCredentialsStore,
  previewOf,
  SECRET_PROPERTY_NAMES,
  type CredentialInput,
  type CredentialKind,
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

    // Non-ASCII on purpose: `btoa` throws above U+00FF.
    const decoded = Buffer.from(
      applied.headers.Authorization!.slice("Basic ".length),
      "base64",
    ).toString("utf8");
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

  it("passes a service account through unchanged", () => {
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
  it("is false for a read-only vault", () => {
    expect(isCredentialsStore(createMemoryCredentialsVault())).toBe(false);
  });

  it("is true for a writable one", () => {
    expect(isCredentialsStore(createMemoryCredentialsStore())).toBe(true);
  });
});

describe("the memory store", () => {
  it("resolves what it was given as applied auth", async () => {
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
  it("covers every secret-bearing field of every input kind", () => {
    // Keyed by kind, so adding a credential kind without a sample here is a
    // type error rather than a test that silently covers less.
    const samplesByKind = {
      NONE: { kind: "NONE" },
      BEARER: { kind: "BEARER", token: "t" },
      API_KEY_HEADER: { kind: "API_KEY_HEADER", header: "X", value: "v" },
      API_KEY_QUERY: { kind: "API_KEY_QUERY", param: "p", value: "v" },
      BASIC: { kind: "BASIC", username: "u", password: "p" },
      SERVICE_ACCOUNT: {
        kind: "SERVICE_ACCOUNT",
        projectId: "p",
        clientEmail: "e",
        privateKey: "k",
      },
    } satisfies {
      [K in CredentialKind]: Extract<CredentialInput, { kind: K }>;
    };
    const samples: CredentialInput[] = Object.values(samplesByKind);

    // Safe to show.
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
