/**
 * The chat relay writes a keepalive every 15 s, so a stream that stays silent
 * much longer than that has lost its connection without closing it. This
 * watches the raw bytes (keepalive comments included) and asks `onIdle` what
 * to do after `idleMs` without any: an SSE frame to end the stream with, or
 * null to keep waiting.
 */

export const STREAM_IDLE_MS = 60_000;

const encoder = new TextEncoder();

/** An AG-UI event as one SSE frame. */
export function sseFrame(event: Record<string, unknown>): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export function watchIdle(
  body: ReadableStream<Uint8Array>,
  idleMs: number,
  onIdle: () => Promise<string | null>
): ReadableStream<Uint8Array> {
  const reader = body.getReader();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let closed = false;

  return new ReadableStream<Uint8Array>({
    start(controller) {
      const stop = () => {
        closed = true;
        clearTimeout(timer);
      };
      const finish = (frame: string) => {
        if (closed) return;
        stop();
        controller.enqueue(encoder.encode(frame));
        controller.close();
        reader.cancel().catch(() => {});
      };
      const arm = () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          onIdle().then(
            (frame) => {
              if (closed) return;
              if (frame === null) arm();
              else finish(frame);
            },
            () => {
              if (!closed) arm();
            }
          );
        }, idleMs);
      };
      const pump = (): void => {
        reader.read().then(
          ({ done, value }) => {
            if (closed) return;
            if (done) {
              stop();
              controller.close();
              return;
            }
            arm();
            controller.enqueue(value);
            pump();
          },
          (err: unknown) => {
            if (closed) return;
            stop();
            controller.error(err);
          }
        );
      };
      arm();
      pump();
    },
    cancel(reason) {
      closed = true;
      clearTimeout(timer);
      return reader.cancel(reason);
    },
  });
}
