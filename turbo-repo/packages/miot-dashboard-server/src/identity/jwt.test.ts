/**
 * What is tested here is our policy, not jose's correctness: which algorithm
 * is accepted, and whether a failure is a refused credential or an outage.
 * Parsing, signatures and the registered claims are jose's, and restating its
 * behaviour in assertions would only pin the version we happened to install.
 */

import { beforeAll, describe, expect, it } from "vitest";
import {
  generateTestKeyPair,
  signHs256,
  signRs256,
  validClaims,
  type TestKeyPair,
} from "../test/tokens";
import { JwtVerificationError, verifyJwt, type KeyRing } from "./jwt";
import { hmacKeyFromSecret } from "./keys";

let pair: TestKeyPair;

// One key pair for the file: generation is the only slow part of these tests.
beforeAll(async () => {
  pair = await generateTestKeyPair("test-key");
});

const rsaOptions = () => ({
  keys: pair.publicKey,
  algorithm: "RS256" as const,
  issuer: "https://issuer.test/",
  audience: ["miot-dashboards"],
});

const SECRET = hmacKeyFromSecret("a-shared-secret-of-at-least-32-bytes");

const hmacOptions = () => ({
  keys: SECRET,
  algorithm: "HS256" as const,
  issuer: "https://issuer.test/",
  audience: ["miot-dashboards"],
});

describe("verifyJwt", () => {
  it("accepts a token this issuer signed for this audience", async () => {
    const token = await signRs256(pair.privateKey, {
      header: { kid: pair.kid },
      claims: validClaims({ sub: "auth0|alice" }),
    });
    await expect(verifyJwt(token, rsaOptions())).resolves.toMatchObject({
      sub: "auth0|alice",
    });
  });

  it("accepts an HS256 token when HS256 is the configured algorithm", async () => {
    const token = await signHs256(SECRET, { claims: validClaims() });
    await expect(verifyJwt(token, hmacOptions())).resolves.toMatchObject({
      sub: "auth0|alice",
    });
  });

  describe("algorithm confusion", () => {
    it("refuses an HS256 token keyed with the RSA public key", async () => {
      // The attack: the RS256 public key is published, so anyone can take it
      // and use its bytes as an HMAC secret. A verifier that reads `alg` from
      // the token and picks a key accordingly validates the result and hands
      // the attacker any identity they asked for. `jwtVerify` accepts
      // whatever the key supports unless it is told which algorithm to use,
      // so passing that is the whole defence.
      const forged = await signHs256(pair.spki, {
        claims: validClaims({ sub: "auth0|attacker" }),
      });

      await expect(verifyJwt(forged, rsaOptions())).rejects.toThrow(
        JwtVerificationError,
      );
    });

    it("refuses an unsigned token", async () => {
      const part = (value: unknown) =>
        Buffer.from(JSON.stringify(value)).toString("base64url");
      const unsigned = `${part({ alg: "none", typ: "JWT" })}.${part(validClaims())}.`;

      await expect(verifyJwt(unsigned, rsaOptions())).rejects.toThrow(
        JwtVerificationError,
      );
    });

    it("refuses an RS256 token when HS256 is configured", async () => {
      const token = await signRs256(pair.privateKey, {
        claims: validClaims(),
      });
      await expect(verifyJwt(token, hmacOptions())).rejects.toThrow(
        JwtVerificationError,
      );
    });
  });

  it("refuses a token signed by a key it does not trust", async () => {
    const attacker = await generateTestKeyPair("test-key");
    const forged = await signRs256(attacker.privateKey, {
      header: { kid: pair.kid },
      claims: validClaims({ sub: "auth0|attacker" }),
    });
    await expect(verifyJwt(forged, rsaOptions())).rejects.toThrow(
      JwtVerificationError,
    );
  });

  it("lets a key source failure through instead of calling it a bad token", async () => {
    // A 401 here would sign every valid session out for as long as the
    // identity provider is unreachable.
    const broken: KeyRing = () =>
      Promise.reject(new Error("JWKS endpoint is down"));
    const token = await signRs256(pair.privateKey, { claims: validClaims() });
    const failure = verifyJwt(token, { ...rsaOptions(), keys: broken });

    await expect(failure).rejects.toThrow("JWKS endpoint is down");
    await expect(failure).rejects.not.toBeInstanceOf(JwtVerificationError);
  });

  describe("claims", () => {
    it("refuses another issuer's token", async () => {
      const token = await signRs256(pair.privateKey, {
        claims: validClaims({ iss: "https://elsewhere.test/" }),
      });
      await expect(verifyJwt(token, rsaOptions())).rejects.toThrow(/iss/);
    });

    it("compares the issuer exactly, trailing slash included", async () => {
      // An issuer identifier names a trust relationship, and any rule that
      // makes two spellings equal makes two different issuers equal too.
      const token = await signRs256(pair.privateKey, {
        claims: validClaims({ iss: "https://issuer.test" }),
      });
      await expect(
        verifyJwt(token, { ...rsaOptions(), issuer: "https://issuer.test/" }),
      ).rejects.toThrow(JwtVerificationError);
    });

    it("refuses a token minted for a different API", async () => {
      const token = await signRs256(pair.privateKey, {
        claims: validClaims({ aud: "some-other-api" }),
      });
      await expect(verifyJwt(token, rsaOptions())).rejects.toThrow(/aud/);
    });

    it("accepts a token whose audience list includes this server", async () => {
      const token = await signRs256(pair.privateKey, {
        claims: validClaims({ aud: ["some-other-api", "miot-dashboards"] }),
      });
      await expect(verifyJwt(token, rsaOptions())).resolves.toBeTruthy();
    });

    it("refuses a token that never expires", async () => {
      // Not jose's default: `requiredClaims` is what makes `exp` mandatory,
      // and a stolen bearer credential that never expires is the whole
      // problem with bearers.
      const claims = validClaims();
      delete claims.exp;
      const token = await signRs256(pair.privateKey, { claims });
      await expect(verifyJwt(token, rsaOptions())).rejects.toThrow(/exp/);
    });

    it("refuses an expired token once it is past the clock tolerance", async () => {
      const expiry = 1_700_000_000;
      const token = await signRs256(pair.privateKey, {
        claims: validClaims({ exp: expiry }),
      });
      const at = (seconds: number) => ({
        ...rsaOptions(),
        clockToleranceSeconds: 30,
        now: () => seconds * 1000,
      });

      await expect(verifyJwt(token, at(expiry + 29))).resolves.toBeTruthy();
      await expect(verifyJwt(token, at(expiry + 31))).rejects.toThrow(
        JwtVerificationError,
      );
    });

    it("refuses a token that is not valid yet", async () => {
      const start = 1_700_000_000;
      const token = await signRs256(pair.privateKey, {
        claims: validClaims({ nbf: start, exp: start + 3600 }),
      });
      await expect(
        verifyJwt(token, {
          ...rsaOptions(),
          clockToleranceSeconds: 30,
          now: () => (start - 31) * 1000,
        }),
      ).rejects.toThrow(JwtVerificationError);
    });
  });

  it.each([
    ["not a token at all", "not-a-token"],
    ["two segments", "aaa.bbb"],
    ["four segments", "aaa.bbb.ccc.ddd"],
    ["a segment that is not base64url", "not+base64url.e30.x"],
  ])(
    "refuses %s as a bad credential, not a server fault",
    async (_n, token) => {
      await expect(verifyJwt(token, rsaOptions())).rejects.toThrow(
        JwtVerificationError,
      );
    },
  );
});
