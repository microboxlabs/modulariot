import { beforeAll, describe, expect, it } from "vitest";
import {
  generateTestKeyPair,
  signHs256,
  signNone,
  signRs256,
  validClaims,
  type TestKeyPair,
} from "../test/tokens";
import { JwtVerificationError, verifyJwt, type KeyRing } from "./jwt";
import { createStaticKeyRing } from "./keys";

let pair: TestKeyPair;

// One key pair for the file: generation is the only slow part of these tests.
beforeAll(() => {
  pair = generateTestKeyPair("test-key");
});

const rsaOptions = () => ({
  keys: createStaticKeyRing(pair.publicKey),
  algorithm: "RS256" as const,
  issuer: "https://issuer.test/",
  audience: ["miot-dashboards"],
});

const SECRET = Buffer.from("a-shared-secret-of-at-least-32-bytes");

const hmacOptions = () => ({
  keys: createStaticKeyRing(SECRET),
  algorithm: "HS256" as const,
  issuer: "https://issuer.test/",
  audience: ["miot-dashboards"],
});

describe("verifyJwt", () => {
  it("accepts a token this issuer signed for this audience", async () => {
    const token = signRs256(pair.privateKey, {
      header: { kid: pair.kid },
      claims: validClaims({ sub: "auth0|alice" }),
    });
    await expect(verifyJwt(token, rsaOptions())).resolves.toMatchObject({
      sub: "auth0|alice",
    });
  });

  it("accepts an HS256 token when HS256 is the configured algorithm", async () => {
    const token = signHs256(SECRET, { claims: validClaims() });
    await expect(verifyJwt(token, hmacOptions())).resolves.toMatchObject({
      sub: "auth0|alice",
    });
  });

  describe("algorithm confusion", () => {
    it("refuses an HS256 token keyed with the RSA public key", async () => {
      // The attack: the RS256 public key is published, so anyone can take it
      // and use its bytes as an HMAC secret. A verifier that reads `alg` from
      // the token and then picks a key accordingly validates the result and
      // hands the attacker any identity they asked for.
      const publicKeyBytes = pair.publicKey.export({
        type: "spki",
        format: "pem",
      }) as string;
      const forged = signHs256(publicKeyBytes, {
        claims: validClaims({ sub: "auth0|attacker" }),
      });

      await expect(verifyJwt(forged, rsaOptions())).rejects.toThrow(
        JwtVerificationError,
      );
    });

    it('refuses an unsigned token, whatever "none" is spelled as', async () => {
      const token = signNone({ claims: validClaims() });
      await expect(verifyJwt(token, rsaOptions())).rejects.toThrow(
        /this server accepts RS256/,
      );
    });

    it("refuses an RS256 token when HS256 is configured", async () => {
      const token = signRs256(pair.privateKey, { claims: validClaims() });
      await expect(verifyJwt(token, hmacOptions())).rejects.toThrow(
        /this server accepts HS256/,
      );
    });
  });

  it("refuses a token whose payload was changed after signing", async () => {
    const token = signRs256(pair.privateKey, {
      claims: validClaims({ sub: "auth0|alice" }),
    });
    const [header, , signature] = token.split(".") as [string, string, string];
    const swapped = Buffer.from(
      JSON.stringify(validClaims({ sub: "auth0|attacker" })),
      "utf8",
    ).toString("base64url");

    await expect(
      verifyJwt(`${header}.${swapped}.${signature}`, rsaOptions()),
    ).rejects.toThrow(/signature/);
  });

  it("checks the signature before it reads any claim", async () => {
    // Order matters: a verifier that validates claims first is acting on
    // values the attacker chose. The token below is wrong in two ways, and
    // the signature has to be the one reported.
    const token = signHs256("not the configured secret", {
      claims: validClaims({ iss: "https://elsewhere.test/" }),
    });
    await expect(verifyJwt(token, hmacOptions())).rejects.toThrow(/signature/);
  });

  it("refuses a signature of the wrong length as a bad token", async () => {
    // `timingSafeEqual` throws when the two buffers differ in length, so the
    // comparison needs its own length check first. Without it a truncated
    // signature leaves the verifier through the wrong exit: a RangeError,
    // which is a 500, rather than a refused credential.
    const token = signHs256(SECRET, { claims: validClaims() });
    const [header, payload, signature] = token.split(".") as [
      string,
      string,
      string,
    ];
    const truncated = `${header}.${payload}.${signature.slice(0, 10)}`;

    await expect(verifyJwt(truncated, hmacOptions())).rejects.toThrow(
      JwtVerificationError,
    );
  });

  it("refuses a token whose key id is not in the key ring", async () => {
    const empty: KeyRing = { resolve: () => Promise.resolve(null) };
    const token = signRs256(pair.privateKey, {
      header: { kid: "rotated-away" },
      claims: validClaims(),
    });
    await expect(
      verifyJwt(token, { ...rsaOptions(), keys: empty }),
    ).rejects.toThrow(/rotated-away/);
  });

  it("lets a key source failure through instead of calling it a bad token", async () => {
    // A 401 here would sign every valid session out for as long as the
    // identity provider is unreachable.
    const broken: KeyRing = {
      resolve: () => Promise.reject(new Error("JWKS endpoint is down")),
    };
    const token = signRs256(pair.privateKey, { claims: validClaims() });
    const failure = verifyJwt(token, { ...rsaOptions(), keys: broken });

    await expect(failure).rejects.toThrow("JWKS endpoint is down");
    await expect(failure).rejects.not.toBeInstanceOf(JwtVerificationError);
  });

  describe("claims", () => {
    it("refuses another issuer's token", async () => {
      const token = signRs256(pair.privateKey, {
        claims: validClaims({ iss: "https://elsewhere.test/" }),
      });
      await expect(verifyJwt(token, rsaOptions())).rejects.toThrow(/issuer/);
    });

    it("treats an issuer with and without its trailing slash as one", async () => {
      const token = signRs256(pair.privateKey, {
        claims: validClaims({ iss: "https://issuer.test" }),
      });
      await expect(
        verifyJwt(token, { ...rsaOptions(), issuer: "https://issuer.test/" }),
      ).resolves.toBeTruthy();
    });

    it("refuses a token minted for a different API", async () => {
      const token = signRs256(pair.privateKey, {
        claims: validClaims({ aud: "some-other-api" }),
      });
      await expect(verifyJwt(token, rsaOptions())).rejects.toThrow(/audience/);
    });

    it("accepts a token whose audience list includes this server", async () => {
      const token = signRs256(pair.privateKey, {
        claims: validClaims({ aud: ["some-other-api", "miot-dashboards"] }),
      });
      await expect(verifyJwt(token, rsaOptions())).resolves.toBeTruthy();
    });

    it("refuses a token with no audience at all", async () => {
      const claims = validClaims();
      delete claims.aud;
      const token = signRs256(pair.privateKey, { claims });
      await expect(verifyJwt(token, rsaOptions())).rejects.toThrow(/audience/);
    });

    it("refuses a token that never expires", async () => {
      const claims = validClaims();
      delete claims.exp;
      const token = signRs256(pair.privateKey, { claims });
      await expect(verifyJwt(token, rsaOptions())).rejects.toThrow(/exp/);
    });

    it("refuses an expired token once it is past the clock tolerance", async () => {
      const expiry = 1_700_000_000;
      const token = signRs256(pair.privateKey, {
        claims: validClaims({ exp: expiry }),
      });
      const at = (seconds: number) => ({
        ...rsaOptions(),
        clockToleranceSeconds: 30,
        now: () => seconds * 1000,
      });

      await expect(verifyJwt(token, at(expiry + 29))).resolves.toBeTruthy();
      await expect(verifyJwt(token, at(expiry + 31))).rejects.toThrow(
        /expired/,
      );
    });

    it("refuses a token that is not valid yet", async () => {
      const start = 1_700_000_000;
      const token = signRs256(pair.privateKey, {
        claims: validClaims({ nbf: start, exp: start + 3600 }),
      });
      await expect(
        verifyJwt(token, {
          ...rsaOptions(),
          clockToleranceSeconds: 30,
          now: () => (start - 31) * 1000,
        }),
      ).rejects.toThrow(/not valid yet/);
    });
  });

  describe("malformed input", () => {
    it.each([
      ["not a token at all", "not-a-token"],
      ["two segments", "aaa.bbb"],
      ["four segments", "aaa.bbb.ccc.ddd"],
    ])("refuses %s", async (_name, token) => {
      await expect(verifyJwt(token, rsaOptions())).rejects.toThrow(
        JwtVerificationError,
      );
    });

    it("refuses a segment that is not base64url", async () => {
      const token = signRs256(pair.privateKey, { claims: validClaims() });
      const [, payload, signature] = token.split(".") as [
        string,
        string,
        string,
      ];
      await expect(
        verifyJwt(`not+base64url.${payload}.${signature}`, rsaOptions()),
      ).rejects.toThrow(/base64url/);
    });

    it("refuses a token demanding extensions we do not implement", async () => {
      const token = signRs256(pair.privateKey, {
        header: { crit: ["https://example.test/must-understand"] },
        claims: validClaims(),
      });
      await expect(verifyJwt(token, rsaOptions())).rejects.toThrow(
        /unsupported extensions/,
      );
    });

    it("refuses a token declaring a type that is not a JWT", async () => {
      const token = signRs256(pair.privateKey, {
        header: { typ: "JWE" },
        claims: validClaims(),
      });
      await expect(verifyJwt(token, rsaOptions())).rejects.toThrow(
        /token type/,
      );
    });

    it("accepts the at+jwt type an OAuth access token carries", async () => {
      const token = signRs256(pair.privateKey, {
        header: { typ: "at+jwt" },
        claims: validClaims(),
      });
      await expect(verifyJwt(token, rsaOptions())).resolves.toBeTruthy();
    });
  });
});
