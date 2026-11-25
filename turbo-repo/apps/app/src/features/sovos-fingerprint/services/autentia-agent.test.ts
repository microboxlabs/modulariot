import { beforeAll, describe, expect, it, vi } from "vitest";
import { webcrypto } from "node:crypto";
import {
  buildTransactionRequest,
  runAgentTransaction,
  verifyAgentSignature,
} from "./autentia-agent";

const subtle = webcrypto.subtle as SubtleCrypto;

let privateKey: CryptoKey;
let spkiB64: string;

function bytesToHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function bytesToB64(bytes: ArrayBuffer): string {
  return Buffer.from(bytes).toString("base64");
}

/** Builds a response body signed the way the legacy plugin verifies it. */
async function signedResponse(
  params: Record<string, unknown>,
  token: string,
  hash: "SHA-256" | "SHA-1" = "SHA-256"
): Promise<string> {
  const unsigned = JSON.stringify({ ParamsGet: params, token, signature: "" });
  const key = await subtle.importKey(
    "pkcs8",
    await subtle.exportKey("pkcs8", privateKey),
    { name: "RSASSA-PKCS1-v1_5", hash },
    false,
    ["sign"]
  );
  const sig = await subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  return unsigned.replace('"signature":""', `"signature":"${bytesToHex(sig)}"`);
}

function agentFetch(reply: (token: string) => Promise<string> | string, status = 200) {
  return vi.fn(async (url: string | URL | Request) => {
    const token = String(url).split("/").pop()!;
    const text = await reply(token);
    return new Response(text, { status });
  }) as unknown as typeof fetch;
}

beforeAll(async () => {
  const pair = await subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"]
  );
  privateKey = pair.privateKey;
  spkiB64 = bytesToB64(await subtle.exportKey("spki", pair.publicKey));
});

describe("buildTransactionRequest", () => {
  it("produces the same package the legacy plugin sends", () => {
    const req = buildTransactionRequest("x/verifica", { Rut: "1-9" }, ["Erc", "NroAudit"], true, 42);
    expect(req).toEqual({
      hookAutentia: true,
      token: 42,
      paquete: [
        { comando: "ParamsInit", param: "Rut,Erc,NroAudit" },
        { comando: "ParamsSet", param: [{ idx: 1, valor: "1-9" }] },
        { comando: "Transaccion", param: "x/verifica" },
        { comando: "ParamsGet", param: 2, paramName: "Erc" },
        { comando: "ParamsGet", param: 3, paramName: "NroAudit" },
      ],
    });
  });
});

describe("verifyAgentSignature", () => {
  it("verifies a SHA-256 signature over the body with the signature blanked", async () => {
    const text = await signedResponse({ Erc: 0, NroAudit: "A-1" }, "7");
    const sig = /"signature":"([0-9a-f]+)"/.exec(text)![1];
    await expect(verifyAgentSignature(text, sig, spkiB64, subtle)).resolves.toEqual({
      hash: "SHA-256",
      encoding: "utf-8",
      tokenBlanked: false,
    });
  });

  it("also accepts a SHA-1 signature", async () => {
    const text = await signedResponse({ Erc: 0 }, "7", "SHA-1");
    const sig = /"signature":"([0-9a-f]+)"/.exec(text)![1];
    await expect(verifyAgentSignature(text, sig, spkiB64, subtle)).resolves.toMatchObject({ hash: "SHA-1" });
  });

  it("returns null when the body was altered", async () => {
    const text = await signedResponse({ Erc: 0, NroAudit: "A-1" }, "7");
    const sig = /"signature":"([0-9a-f]+)"/.exec(text)![1];
    const tampered = text.replace("A-1", "A-2");
    await expect(verifyAgentSignature(tampered, sig, spkiB64, subtle)).resolves.toBeNull();
  });
});

describe("runAgentTransaction", () => {
  const base = { rut: "1-9", autentiaPath: "x/verifica", subtle };

  it("returns ParamsGet when the agent answers a signed success with the same token", async () => {
    const fetchImpl = agentFetch((token) => signedResponse({ Erc: 0, NroAudit: "A-1", Rut: "1-9" }, token));
    const result = await runAgentTransaction({ ...base, fetchImpl, publicKeySpkiB64: spkiB64 });
    expect(result.params).toMatchObject({ Erc: 0, NroAudit: "A-1" });
    expect(result.verifiedWith.hash).toBe("SHA-256");
    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toBe(`https://plugin.autentia.mb:7777/json-handler/${result.token}`);
    expect(init.headers).toEqual({ "Content-Type": "text/plain; charset=ISO8859_1" });
  });

  it("rejects TRANSACTION_FAILED with the agent's text when Erc is not 0", async () => {
    const fetchImpl = agentFetch((token) => signedResponse({ Erc: 3, ercText: "Huella no coincide" }, token));
    await expect(runAgentTransaction({ ...base, fetchImpl, publicKeySpkiB64: spkiB64 })).rejects.toMatchObject({
      code: "TRANSACTION_FAILED",
      erc: 3,
      message: "Huella no coincide",
    });
  });

  it("rejects TOKEN_MISMATCH when the echoed token differs", async () => {
    const fetchImpl = agentFetch(() => signedResponse({ Erc: 0 }, "1"));
    await expect(runAgentTransaction({ ...base, fetchImpl, publicKeySpkiB64: spkiB64 })).rejects.toMatchObject({
      code: "TOKEN_MISMATCH",
    });
  });

  it("rejects SIGNATURE_INVALID when the key does not match", async () => {
    const fetchImpl = agentFetch((token) => signedResponse({ Erc: 0 }, token));
    await expect(runAgentTransaction({ ...base, fetchImpl })).rejects.toMatchObject({
      code: "SIGNATURE_INVALID",
    });
  });

  it("rejects AGENT_UNREACHABLE on a network failure and TIMEOUT on abort", async () => {
    const down = vi.fn(async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    await expect(runAgentTransaction({ ...base, fetchImpl: down })).rejects.toMatchObject({
      code: "AGENT_UNREACHABLE",
    });

    const hanging = vi.fn(
      (_url: unknown, init: RequestInit) =>
        new Promise((_, reject) => {
          init.signal?.addEventListener("abort", () => {
            const e = new Error("aborted");
            e.name = "AbortError";
            reject(e);
          });
        })
    ) as unknown as typeof fetch;
    await expect(runAgentTransaction({ ...base, fetchImpl: hanging, timeoutMs: 20 })).rejects.toMatchObject({
      code: "TIMEOUT",
    });
  });
});
