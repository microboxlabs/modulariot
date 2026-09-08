import { AutentiaError } from "./autentia";
import type { AutentiaParamsGet } from "./autentia.types";

/**
 * Native client for the local fingerprint agent. Same request the legacy
 * `pluginautentiav3.js` sends, without jQuery, blockUI or jsrsasign.
 * Not wired into the totem yet; see docs/totem-fingerprint-plugin.md.
 */

export const AUTENTIA_AGENT_BASE_URL = "https://plugin.autentia.mb:7777";

/** RSA-2048 public key extracted from the certificate embedded in pluginautentiav3.js. */
export const AUTENTIA_PUBLIC_KEY_SPKI_B64 =
  "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEArTY9W9Q6SPmBIA1luxoKyrbk+NIc9PNFuEuyeHggsmGOwr7baZhJ0j15QPTeTFqSRiBFdtpojlVv9ssucT3Z5UF6P0PrM5HwfndJfCsgRa15/uYKdC/ZjmXcZCOOT/7I0ezbj0BBoHcJ0cIK5TUVQGikFabd0uJrIFkP8njopGTAxsDr+qJ+HYP08LfZ8D3cCwML2QdgCg2/Rh6j/QPb08s3wzxC+3VR4jtl/+X1GFW/FXIi7ulSdhkjKSb5MK0u4B3DTVSQJRq8UMn3rOwjO0NbTA6kz6UaVYqox3Yup9aXaIysHe4dARX+gWcUzjsu2/d41psAJRxEAicaELJ9cwIDAQAB";

export const DEFAULT_OUTPUTS = [
  "Erc",
  "NroAudit",
  "ErcDesc",
  "oNombres",
  "oSexo",
  "oFchNac",
];

type Hash = "SHA-256" | "SHA-1";
type Encoding = "utf-8" | "latin1";

export type AgentCommand =
  | { comando: "ParamsInit"; param: string }
  | { comando: "ParamsSet"; param: { idx: number; valor: string }[] }
  | { comando: "Transaccion"; param: string }
  | { comando: "ParamsGet"; param: number; paramName: string };

export type AgentRequest = {
  paquete: AgentCommand[];
  hookAutentia: boolean;
  token: number;
};

export type AgentTransactionOptions = {
  rut: string;
  autentiaPath: string;
  outputs?: string[];
  giveFocus?: boolean;
  timeoutMs?: number;
  baseUrl?: string;
  publicKeySpkiB64?: string;
  fetchImpl?: typeof fetch;
  subtle?: SubtleCrypto;
};

export type AgentTransactionResult = {
  params: AutentiaParamsGet;
  token: number;
  verifiedWith: { hash: Hash; encoding: Encoding; tokenBlanked: boolean };
  durationMs: number;
};

export function buildTransactionRequest(
  path: string,
  inputs: Record<string, string>,
  outputs: string[],
  giveFocus: boolean,
  token: number
): AgentRequest {
  const names = Object.keys(inputs);
  const set = names.map((name, i) => ({ idx: i + 1, valor: inputs[name] }));
  for (const out of outputs) {
    if (!names.includes(out)) names.push(out);
  }
  const paquete: AgentCommand[] = [
    { comando: "ParamsInit", param: names.join(",") },
  ];
  if (set.length) paquete.push({ comando: "ParamsSet", param: set });
  paquete.push({ comando: "Transaccion", param: path });
  for (const out of outputs) {
    paquete.push({
      comando: "ParamsGet",
      param: names.indexOf(out) + 1,
      paramName: out,
    });
  }
  return { paquete, hookAutentia: giveFocus, token };
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.trim();
  if (clean.length % 2 !== 0 || /[^0-9a-fA-F]/.test(clean)) {
    throw new AutentiaError("SIGNATURE_INVALID", "signature is not hex");
  }
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function encode(text: string, encoding: Encoding): Uint8Array {
  if (encoding === "utf-8") return new TextEncoder().encode(text);
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) out[i] = text.charCodeAt(i) & 0xff;
  return out;
}

const SIGNATURE_FIELD = /"signature":"[^"]+"/;
const TOKEN_FIELD = /"token":"[^"]+"/;

/**
 * Verifies the agent's response the way the legacy plugin does: the signed
 * text is the body with `"signature":"<hex>"` blanked, and if that fails,
 * with `"token":"<x>"` blanked too. The digest and the text encoding are not
 * documented, so both SHA-256/SHA-1 and UTF-8/Latin-1 are tried.
 */
export async function verifyAgentSignature(
  responseText: string,
  signatureHex: string,
  publicKeySpkiB64 = AUTENTIA_PUBLIC_KEY_SPKI_B64,
  subtle: SubtleCrypto = globalThis.crypto.subtle
): Promise<AgentTransactionResult["verifiedWith"] | null> {
  const signature = hexToBytes(signatureHex);
  const candidates = [
    { text: responseText.replace(SIGNATURE_FIELD, '"signature":""'), tokenBlanked: false },
  ];
  candidates.push({
    text: candidates[0].text.replace(TOKEN_FIELD, '"token":""'),
    tokenBlanked: true,
  });
  const keyBytes = base64ToBytes(publicKeySpkiB64);

  for (const hash of ["SHA-256", "SHA-1"] as Hash[]) {
    const key = await subtle.importKey(
      "spki",
      keyBytes,
      { name: "RSASSA-PKCS1-v1_5", hash },
      false,
      ["verify"]
    );
    for (const candidate of candidates) {
      for (const encoding of ["utf-8", "latin1"] as Encoding[]) {
        const ok = await subtle.verify(
          "RSASSA-PKCS1-v1_5",
          key,
          signature,
          encode(candidate.text, encoding)
        );
        if (ok) return { hash, encoding, tokenBlanked: candidate.tokenBlanked };
      }
    }
  }
  return null;
}

function readErc(params: Record<string, unknown>): number | undefined {
  const raw = params.Erc ?? params.erc;
  if (raw === undefined || raw === null) return undefined;
  const n = typeof raw === "number" ? raw : parseInt(String(raw), 10);
  return Number.isNaN(n) ? undefined : n;
}

export async function runAgentTransaction(
  options: AgentTransactionOptions
): Promise<AgentTransactionResult> {
  const {
    rut,
    autentiaPath,
    outputs = DEFAULT_OUTPUTS,
    giveFocus = true,
    timeoutMs = 120_000,
    baseUrl = AUTENTIA_AGENT_BASE_URL,
    publicKeySpkiB64 = AUTENTIA_PUBLIC_KEY_SPKI_B64,
    fetchImpl = fetch,
    subtle = globalThis.crypto.subtle,
  } = options;

  const token = Math.floor(Math.random() * 1e15);
  const body = buildTransactionRequest(autentiaPath, { Rut: rut }, outputs, giveFocus, token);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();

  let text: string;
  try {
    const response = await fetchImpl(`${baseUrl}/json-handler/${token}`, {
      method: "POST",
      headers: { "Content-Type": "text/plain; charset=ISO8859_1" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new AutentiaError(
        "AGENT_UNREACHABLE",
        `fingerprint agent answered HTTP ${response.status}`
      );
    }
    text = await response.text();
  } catch (err) {
    if (err instanceof AutentiaError) throw err;
    if ((err as Error)?.name === "AbortError") {
      throw new AutentiaError("TIMEOUT", `fingerprint agent did not answer within ${timeoutMs}ms`);
    }
    throw new AutentiaError(
      "AGENT_UNREACHABLE",
      err instanceof Error ? err.message : String(err)
    );
  } finally {
    clearTimeout(timer);
  }

  let parsed: {
    ParamsGet?: Record<string, unknown>;
    token?: string | number;
    signature?: string;
    error?: unknown;
  };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new AutentiaError("INVALID_RESPONSE", "fingerprint agent answered with non-JSON text");
  }
  if (parsed.error) {
    throw new AutentiaError("INVALID_RESPONSE", String(parsed.error));
  }
  const params = parsed.ParamsGet;
  if (!params) {
    throw new AutentiaError("INVALID_RESPONSE", "fingerprint agent answered without ParamsGet");
  }
  const erc = readErc(params);
  if (erc !== 0) {
    const ercText = String(params.ercText ?? params.ErcText ?? params.ErcDesc ?? "");
    throw new AutentiaError(
      "TRANSACTION_FAILED",
      ercText || `rut validation failed (Erc=${erc ?? "missing"})`,
      { erc, ercText, ercDesc: params.ErcDesc as string | undefined }
    );
  }
  const echoed =
    typeof parsed.token === "number"
      ? parsed.token
      : parseFloat(String(parsed.token ?? "").replace(",", "."));
  if (echoed !== token) {
    throw new AutentiaError("TOKEN_MISMATCH", "fingerprint agent echoed another transaction's token");
  }
  if (typeof parsed.signature !== "string" || parsed.signature.length === 0) {
    throw new AutentiaError("SIGNATURE_INVALID", "fingerprint agent answered without a signature");
  }
  const verifiedWith = await verifyAgentSignature(text, parsed.signature, publicKeySpkiB64, subtle);
  if (!verifiedWith) {
    throw new AutentiaError("SIGNATURE_INVALID", "fingerprint agent signature did not verify");
  }

  return {
    params: params as unknown as AutentiaParamsGet,
    token,
    verifiedWith,
    durationMs: Date.now() - startedAt,
  };
}
