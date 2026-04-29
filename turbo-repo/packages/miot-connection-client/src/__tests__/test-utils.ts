export function createMockFetch<T>(response: T, status = 200) {
  const call = { url: "", init: {} as RequestInit };
  const fn = async (url: string | URL | Request, init: RequestInit = {}) => {
    if (typeof url === "string") {
      call.url = url;
    } else if (url instanceof URL) {
      call.url = url.href;
    } else {
      call.url = url.url;
    }
    call.init = init;
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => response,
      text: async () => JSON.stringify(response),
    } as Response;
  };
  return { fn, call };
}
