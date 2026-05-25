export interface MockCall {
  url: string;
  init: RequestInit;
}

export function createMockFetch<T>(response: T, status = 200) {
  const call: MockCall = { url: "", init: {} as RequestInit };
  // Typed to match the global fetch signature so callers can pass `fn`
  // straight into ClientConfig.fetch without an `as unknown as` cast.
  const fn: typeof globalThis.fetch = async (input, init = {}) => {
    call.url = urlOf(input);
    call.init = init;
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => response,
      text: async () =>
        typeof response === "string" ? response : JSON.stringify(response),
    } as Response;
  };
  return { fn, call };
}

export function createMockSseFetch(body: string, status = 200) {
  const call: MockCall = { url: "", init: {} as RequestInit };
  const fn: typeof globalThis.fetch = async (input, init = {}) => {
    call.url = urlOf(input);
    call.init = init;
    const enc = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(enc.encode(body));
        controller.close();
      },
    });
    return {
      ok: status >= 200 && status < 300,
      status,
      body: stream,
    } as unknown as Response;
  };
  return { fn, call };
}

function urlOf(input: string | URL | Request): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}
