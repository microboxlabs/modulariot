import { DashboardServerError, isDashboardServerError } from "../access/errors";

export const DEFAULT_MAX_BODY_BYTES = 1024 * 1024;

/** Count received bytes rather than trusting the caller's Content-Length. */
export async function readJsonBody(
  request: Request,
  maxBytes: number,
): Promise<unknown> {
  if (request.body === null)
    throw DashboardServerError.badRequest("Request body must be valid JSON");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        // Do not wait for a custom stream's cancellation callback to finish.
        void reader.cancel().catch(() => {});
        throw DashboardServerError.payloadTooLarge(
          `Request body exceeds the ${maxBytes} byte limit`,
        );
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    ) as unknown;
  } catch (error) {
    if (isDashboardServerError(error)) throw error;
    throw DashboardServerError.badRequest("Request body must be valid JSON");
  } finally {
    reader.releaseLock();
  }
}
