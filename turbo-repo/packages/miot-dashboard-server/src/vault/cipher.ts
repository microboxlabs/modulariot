/**
 * AES-256-GCM over WebCrypto, for credentials at rest.
 *
 * The envelope is `v1:<base64 iv>:<base64 ciphertext+tag>`. The version
 * prefix tells a later scheme apart on read, so rows can be re-encrypted
 * while the server keeps running.
 *
 * GCM's tag makes a tampered row fail to decrypt rather than decrypt to
 * something else.
 */

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
 * Hashed to 32 bytes, so a key of any length gives a valid AES-256 key. This
 * is not a KDF: the configured key is expected to be random already, and
 * stretching a weak one would not make it strong.
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
  // Imported once and reused. The imported key is not extractable.
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
        Buffer.from(iv).toString("base64"),
        Buffer.from(ciphertext).toString("base64"),
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
          { name: "AES-GCM", iv: Buffer.from(iv, "base64") },
          await imported,
          Buffer.from(ciphertext, "base64"),
        );
      } catch {
        // Wrong key or a tampered row. The message says neither: a caller
        // cannot act on the difference, and an attacker could use it.
        throw new CipherError("Stored credential could not be decrypted");
      }
      return new TextDecoder().decode(plaintext);
    },
  };
}
