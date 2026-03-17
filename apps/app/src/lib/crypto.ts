import "server-only";
import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

let _cachedKey: Buffer | null = null;

function getEncryptionKey(): Buffer {
  if (_cachedKey) return _cachedKey;

  const key = process.env.DATA_SOURCE_ENCRYPTION_KEY;
  if (!key) {
    throw new Error(
      "DATA_SOURCE_ENCRYPTION_KEY environment variable is required"
    );
  }
  // Key must be 32 bytes for AES-256 (createCipheriv). Accept hex-encoded (64 chars) or raw 32-byte UTF-8 string.
  let buf: Buffer;
  if (key.length === 64) {
    buf = Buffer.from(key, "hex");
    if (buf.length !== 32) {
      throw new Error(
        "DATA_SOURCE_ENCRYPTION_KEY contains invalid hex characters — createCipheriv requires exactly 32 bytes"
      );
    }
  } else {
    buf = Buffer.from(key, "utf-8");
    if (buf.length !== 32) {
      throw new Error(
        `DATA_SOURCE_ENCRYPTION_KEY must be exactly 32 bytes for createCipheriv (got ${buf.length} bytes)`
      );
    }
  }
  _cachedKey = buf;
  return _cachedKey;
}

export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  // Format: base64(iv + tag + ciphertext)
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decrypt(encoded: string): string {
  const key = getEncryptionKey();
  const data = Buffer.from(encoded, "base64");

  const iv = data.subarray(0, IV_LENGTH);
  const tag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = data.subarray(IV_LENGTH + TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  return decipher.update(ciphertext) + decipher.final("utf8");
}

export function maskToken(token: string): string {
  if (token.length <= 4) return "****";
  return "****" + token.slice(-4);
}
