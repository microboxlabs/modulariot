/**
 * AES-256-GCM over WebCrypto, for credentials at rest.
 *
 * The envelope is `v1:<base64 iv>:<base64 ciphertext+tag>`. The version
 * prefix is there so a later scheme can be told apart on read, which is what
 * makes a re-encrypt pass possible without a flag day.
 *
 * GCM, not CBC: the tag makes a tampered row fail to decrypt rather than
 * decrypt to something else. A wrong key fails the same way, so there is one
 * failure to handle instead of two.
 */

import { base64FromBytes, bytesFromBase64 } from "../net/base64";

const VERSION = "v1";
const IV_BYTES = 12;

/** The scheme this build writes. Rows carry it so older ones stay readable. */
export const CIPHER_VERSION = 1;

export class CipherError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CipherError";
  }
}

export interface Cipher {
  encrypt(plaintext: string): Promise<string>;
  decrypt(envelope: string): Promise<string>;
}

/**
 * The key material is hashed to 32 bytes rather than used directly, so a
 * configured key of any length yields a valid AES-256 key. It is not a KDF
 * and is not meant to be: the configured value is expected to be random
 * already, and stretching a low-entropy one would only make it look safe.
 */
async function aesKey(key: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(key),
  );
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

export function createCipher(key: string): Cipher {
  if (key.length === 0) {
    throw new CipherError("A cipher needs a key; an empty one was given");
  }
  // Imported once and reused. The key is not extractable, so holding it costs
  // nothing a caller could read back out.
  const imported = aesKey(key);

  return {
    async encrypt(plaintext) {
      const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
      const ciphertext = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        await imported,
        new TextEncoder().encode(plaintext),
      );
      return [
        VERSION,
        base64FromBytes(iv),
        base64FromBytes(new Uint8Array(ciphertext)),
      ].join(":");
    },

    async decrypt(envelope) {
      const parts = envelope.split(":");
      if (parts.length !== 3 || parts[0] !== VERSION) {
        throw new CipherError(
          "Stored credential is not in a form this build can read",
        );
      }
      const [, iv, ciphertext] = parts as [string, string, string];
      let plaintext: ArrayBuffer;
      try {
        plaintext = await crypto.subtle.decrypt(
          { name: "AES-GCM", iv: bytesFromBase64(iv) },
          await imported,
          bytesFromBase64(ciphertext),
        );
      } catch {
        // Wrong key or a tampered row. The message says neither, because a
        // caller cannot act on the difference and an attacker could.
        throw new CipherError("Stored credential could not be decrypted");
      }
      return new TextDecoder().decode(plaintext);
    },
  };
}
