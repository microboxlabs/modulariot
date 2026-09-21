/**
 * Base64 of a string's UTF-8 bytes.
 *
 * `btoa` alone throws above U+00FF, and `Buffer` is not available on every
 * runtime this package targets.
 */
export function base64Utf8(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
