import { createVerify, generateKeyPairSync } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  GOOGLE_TOKEN_URL,
  serviceAccountAccessToken,
  signAssertion,
} from "./google-service-account";

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});

const grant = {
  clientEmail: "reader@project.iam.gserviceaccount.com",
  privateKey,
  scope: "https://www.googleapis.com/auth/bigquery.readonly",
};

const answering = (status: number, body: unknown) =>
  vi.fn(() =>
    Promise.resolve(Response.json(body, { status })),
  ) as unknown as typeof fetch;

describe("the assertion", () => {
  it("is signed by the private key and names the account", () => {
    const assertion = signAssertion(grant, 1_700_000_000);
    const [header = "", claims = "", signature = ""] = assertion.split(".");

    expect(JSON.parse(Buffer.from(header, "base64url").toString())).toEqual({
      alg: "RS256",
      typ: "JWT",
    });
    expect(JSON.parse(Buffer.from(claims, "base64url").toString())).toEqual({
      iss: grant.clientEmail,
      scope: grant.scope,
      aud: GOOGLE_TOKEN_URL,
      iat: 1_700_000_000,
      exp: 1_700_003_600,
    });
    const verified = createVerify("RSA-SHA256")
      .update(`${header}.${claims}`)
      .verify(publicKey, signature, "base64url");
    expect(verified).toBe(true);
  });

  it("accepts a key whose line breaks are escaped, as in a JSON key file", () => {
    const escaped = privateKey.replace(/\n/g, "\\n");
    expect(() =>
      signAssertion({ ...grant, privateKey: escaped }, 1_700_000_000),
    ).not.toThrow();
  });

  it("names a bad key without quoting it", () => {
    const key =
      "-----BEGIN PRIVATE KEY-----\nnot a key\n-----END PRIVATE KEY-----";
    let message = "";
    try {
      signAssertion({ ...grant, privateKey: key }, 1_700_000_000);
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toMatch(/not a usable RSA key/);
    expect(message).not.toContain("not a key");
  });
});

describe("the exchange", () => {
  it("posts the assertion and returns the token with its expiry", async () => {
    const fetchImpl = answering(200, {
      access_token: "ya29.token",
      expires_in: 3599,
    });
    const access = await serviceAccountAccessToken({
      ...grant,
      fetchImpl,
      now: () => 1_700_000_000_000,
    });

    expect(access).toEqual({
      token: "ya29.token",
      expiresAt: 1_700_000_000_000 + 3599 * 1000,
    });
    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0] as [string, RequestInit];
    expect(url).toBe(GOOGLE_TOKEN_URL);
    const body = new URLSearchParams(init.body as string);
    expect(body.get("grant_type")).toBe(
      "urn:ietf:params:oauth:grant-type:jwt-bearer",
    );
    expect(body.get("assertion")?.split(".")).toHaveLength(3);
  });

  it("reports a refusal by its code, never the description", async () => {
    const fetchImpl = answering(400, {
      error: "invalid_grant",
      error_description: `Invalid JWT Signature for ${grant.clientEmail}`,
    });
    const failure = await serviceAccountAccessToken({
      ...grant,
      fetchImpl,
    }).catch((error: Error) => error.message);

    expect(failure).toBe(
      "The token endpoint refused the service account (400, invalid_grant)",
    );
  });

  it("reports an answer with no token", async () => {
    const fetchImpl = answering(200, { token_type: "Bearer" });
    await expect(
      serviceAccountAccessToken({ ...grant, fetchImpl }),
    ).rejects.toThrow(/no access_token/);
  });
});
