/**
 * Base64, in the forms this package needs.
 *
 * `btoa` alone throws above U+00FF, and `Buffer` is not available on every
 * runtime this package targets, so both go through the byte array.
 */

export function base64FromBytes(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function bytesFromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

/** Base64 of a string's UTF-8 bytes. */
export function base64Utf8(value: string): string {
  return base64FromBytes(new TextEncoder().encode(value));
}
